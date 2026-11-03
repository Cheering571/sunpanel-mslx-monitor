"""
本地 HTTP 代理：把 HTTP 请求通过 SSH exec 转发到 MSLX

用途：调试期浏览器直接访问 MSLX 会跨域，而微应用的请求本来由 Sun-Panel 后端代理。
这个脚本让你在本机用普通 HTTP 客户端调接口，同时请求实际从中间机器发出，
避开 MSLX 的防爆破封禁（被封的是中间机器的 IP）。

仅供本地调试，不要部署到生产环境。

用法：
    set MSLX_PROXY_HOST=192.168.1.111
    set MSLX_PROXY_USER=your-user
    set MSLX_PROXY_PASS=your-password
    set MSLX_TARGET=http://192.168.1.100:1027
    python test/local-proxy.py
"""
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = os.environ.get("MSLX_PROXY_HOST", "")
USER = os.environ.get("MSLX_PROXY_USER", "")
PW = os.environ.get("MSLX_PROXY_PASS", "")
TARGET = os.environ.get("MSLX_TARGET", "http://127.0.0.1:1027")

if not (HOST and USER and PW):
    print("请先设置环境变量 MSLX_PROXY_HOST / MSLX_PROXY_USER / MSLX_PROXY_PASS")
    sys.exit(1)

_client = paramiko.SSHClient()
_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
_client.connect(HOST, port=22, username=USER, password=PW, timeout=15)

_target_base = TARGET.rstrip("/")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def _proxy(self, method):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b""

            url = _target_base + self.path
            parts = [
                "curl", "-s", "-m", "25",
                "-X", method,
                "-H", "'Content-Type: application/json'",
            ]
            tok = self.headers.get("x-user-token")
            if tok:
                parts += ["-H", "'x-user-token: %s'" % tok]
            if body:
                parts += ["--data-binary", "@-"]
            parts += ["'%s'" % url]
            cmd = " ".join(parts)

            stdin, stdout, stderr = _client.exec_command(cmd, timeout=40)
            if body:
                stdin.write(body)
                stdin.flush()
                stdin.channel.shutdown_write()
            out = stdout.read()
            err = stderr.read()
            rc = stdout.channel.recv_exit_status()
            if not out and err:
                out = b'{"code":500,"message":"' + err.strip()[:200] + b'"}'

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
        except Exception as e:
            msg = ('{"code":500,"message":"proxy error: %s"}' % str(e).replace('"', "'")).encode()
            try:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(msg)))
                self.end_headers()
                self.wfile.write(msg)
            except Exception:
                pass

    def do_GET(self):
        self._proxy("GET")

    def do_POST(self):
        self._proxy("POST")


if __name__ == "__main__":
    srv = HTTPServer(("127.0.0.1", 11027), Handler)
    print("PROXY_READY http://127.0.0.1:11027 -> (ssh exec) -> " + _target_base, flush=True)
    srv.serve_forever()
