// Generated by CoffeeScript 1.8.0
(function() {
  var broadcastChattersList, broadcastMsg, createProxy, e, e2, garbage_collect, getRandomRGB, msgs, net, processMessage, router, send_oldmsgs, server_chat_headers, setKey, socks, ws, wsserver;

  net = require('net');

  try {
    ws = require('../src/ws');
    router = require('../src/router')();
  } catch (_error) {
    e = _error;
    try {
      ws = require('../lib/ws');
      router = require('../lib/router')();
    } catch (_error) {
      e2 = _error;
      console.log('node-simple-router must be installed for this to work');
      process.exit(-1);
    }
  }

  socks = [];

  msgs = [];

  setKey = function(sock, key, value) {
    return sock[key] = value;
  };

  broadcastMsg = function(msg) {
    var sock, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = socks.length; _i < _len; _i++) {
      sock = socks[_i];
      try {
        if (sock.readyState === 'open') {
          _results.push(sock.send(msg));
        } else {
          _results.push(void 0);
        }
      } catch (_error) {
        e = _error;
        _results.push(console.log("Error sending data to clients: " + e.message));
      }
    }
    return _results;
  };

  broadcastChattersList = function() {
    var lsocks, sock, _i, _len, _results;
    lsocks = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = socks.length; _i < _len; _i++) {
        sock = socks[_i];
        if (sock.username) {
          _results.push({
            id: sock.id,
            color: sock.color,
            username: sock.username,
            currentRoundTrip: sock.currentRoundTrip
          });
        }
      }
      return _results;
    })();
    _results = [];
    for (_i = 0, _len = socks.length; _i < _len; _i++) {
      sock = socks[_i];
      try {
        if (sock.readyState === 'open') {
          _results.push(sock.send({
            headers: {
              command: 'chatters-list',
              subcommand: 'init'
            },
            body: lsocks
          }));
        } else {
          _results.push(void 0);
        }
      } catch (_error) {
        e = _error;
        _results.push(console.log("Error sending data to clients: " + e.message));
      }
    }
    return _results;
  };

  processMessage = function(sock, msg) {
    var body, headers, key, msgCommand, value;
    headers = msg.headers;
    body = msg.body;
    msgCommand = headers.command;
    switch (msgCommand) {
      case 'chat-message':
        return broadcastMsg(msg);
      case 'set':
        key = headers.key;
        value = body;
        setKey(sock, key, value);
        if (key === 'username') {
          return setImmediate(function() {
            broadcastMsg({
              headers: server_chat_headers,
              body: "Say hi to " + value + " who has joined the chat."
            });
            return broadcastChattersList();
          });
        }
        break;
      case 'reset-color':
        key = 'color';
        value = getRandomRGB();
        setKey(sock, key, value);
        sock.send({
          headers: {
            command: 'set',
            key: key
          },
          body: value
        });
        return broadcastChattersList();
      default:
        return console.log("Received an unrecognized message: " + body);
    }
  };

  getRandomRGB = function() {
    var blue, green, red, _ref;
    red = Math.floor(Math.random() * 128) + 64;
    green = Math.floor(Math.random() * 128) + 64;
    blue = Math.floor(Math.random() * 128) + 64;
    _ref = [red, green, blue].map(function(color) {
      return color.toString(16).replace('0x', '');
    }), red = _ref[0], green = _ref[1], blue = _ref[2];
    return "#" + red + green + blue;
  };

  send_oldmsgs = function(sock) {
    var msg, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = msgs.length; _i < _len; _i++) {
      msg = msgs[_i];
      msg = JSON.parse(msg);
      _results.push(sock.send(msg));
    }
    return _results;
  };

  garbage_collect = function() {
    var index, sock, _i, _len;
    for (index = _i = 0, _len = socks.length; _i < _len; index = ++_i) {
      sock = socks[index];
      if (!sock.username) {
        socks.splice(index, 1);
        return broadcastChattersList();
      }
    }
  };

  server_chat_headers = {
    from: 'SERVER',
    color: '#dd0000',
    command: 'chat-message'
  };

  wsserver = ws.createWebSocketServer(function(websock) {
    var init_websock, nsr_sid;
    nsr_sid = router.utils.getCookie(websock.request, 'nsr_sid').nsr_sid;
    websock.id = nsr_sid ? "nsr-" + nsr_sid + "--" + (router.utils.uuid()) : router.utils.uuid();
    websock.color = getRandomRGB();
    socks.push(websock);
    init_websock = function(ws) {
      return setTimeout((function() {
        var body, headers;
        if ((ws.readyState !== 'open') && (ws.readyState !== 'closed')) {
          console.log("websocket isnt ready to be initialized. Rescheduling...");
          return init_websock(ws);
        }
        if (ws.readyState !== 'closed') {
          headers = {
            command: 'set',
            key: 'id'
          };
          body = ws.id;
          ws.send({
            headers: headers,
            body: body
          });
          headers.key = 'color';
          body = ws.color;
          ws.send({
            headers: headers,
            body: body
          });
          return send_oldmsgs(ws);
        }
      }), 100);
    };
    init_websock(websock);
    websock.on('data', function(opcode, data) {
      var parsed_data;
      parsed_data = JSON.parse(data);
      if (parsed_data.headers.command === 'chat-message') {
        msgs.push(data);
      }
      return processMessage(websock, parsed_data);
    });
    websock.on('heartbeat', function(currentRoundTrip, currentTime) {
      return broadcastChattersList();
    });
    return websock.on('close', function(code, reason) {
      var index, sock, _i, _len, _ref;
      if (websock.username) {
        setImmediate(function() {
          broadcastMsg({
            headers: server_chat_headers,
            body: "" + websock.username + " has left the chat."
          });
          return broadcastChattersList();
        });
      }
      for (index = _i = 0, _len = socks.length; _i < _len; index = ++_i) {
        sock = socks[index];
        if (((_ref = socks[index]) != null ? _ref.id : void 0) === websock.id) {
          socks.splice(index, 1);
        }
      }
      return console.log("web socket closed with code " + (code ? code : 'none') + " owed to " + (reason ? reason : 'no reason provided'));
    });
  });

  createProxy = function(port) {
    var proxyServer;
    proxyServer = net.createServer(function(sock) {
      var wsock;
      console.log("Server raw socket connected.");
      wsock = new ws.WebSocketClientConnection("ws://0.0.0.0:" + (port + 1));
      wsock.color = "#000000";
      wsock.on('close', function(code) {
        return console.log("Proxy WebSocket closed with code:", code);
      });
      wsock.on('data', function(opcode, data) {
        var body, headers, msg, msgCommand;
        msg = JSON.parse(data);
        headers = msg.headers;
        body = msg.body;
        msgCommand = headers.command;
        if (msgCommand === 'chat-message') {
          sock.write("" + (headers.from.replace(/\r/g, '').replace(/\n/g, '')) + ": " + body + "\r\n", "utf8");
        }
        if (msgCommand === 'set') {
          return wsock[headers.key] = body;
        }
      });
      sock.on('error', function(err) {
        console.log("Error on raw socket:", err.message);
        return sock.destroy();
      });
      sock.on('end', function() {
        console.log('Server raw socket disconnected');
        return wsock.close();
      });
      sock.on('data', function(data) {
        var msg;
        if (wsock.readyState !== 'open') {
          return console.log("WebSocket closed, '" + data + "' could not be sent.");
        }
        if (!wsock.username) {
          msg = {
            body: data.toString('utf8').replace(/\r/g, '').replace(/\n/g, ''),
            headers: {
              command: 'set',
              key: 'username'
            }
          };
          wsock.send(JSON.stringify(msg));
          return wsock.username = data.toString('utf8');
        } else {
          msg = {
            body: data.toString('utf8').replace(/\r/g, '').replace(/\n/g, ''),
            headers: {
              command: 'chat-message',
              from: wsock.username,
              color: wsock.color
            }
          };
          if (msg.body.match(/^quit/i)) {
            sock.write('Bye\r\n');
            wsock.close();
            return sock.end();
          }
          return setImmediate(function() {
            if (wsock.readyState === 'open') {
              return wsock.send(JSON.stringify(msg));
            }
          });
        }
      });
      return sock.write("Please enter your name: ");
    });
    return proxyServer.listen(port);
  };

  module.exports = {
    wsserver: wsserver,
    socks: socks,
    msgs: msgs,
    createProxy: createProxy
  };

}).call(this);
