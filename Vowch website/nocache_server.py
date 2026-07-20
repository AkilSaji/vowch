import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class H(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # This server is launched as a background local preview, so it has no
        # interactive console available for request logging.
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8935
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    import functools
    handler = functools.partial(H, directory=directory)
    ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
