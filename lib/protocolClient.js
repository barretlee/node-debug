"use strict";

const ee = require("events");
class ProtocolClient extends ee.EventEmitter {
  constructor() {
    super();
    this.pendingRequests = new Map();
    this.rawData = new Buffer(0);
    this.sequence = 1;
    this.contentLength = -1;
  }
  connect(readable, writable) {
    this.outputStream = writable;
    readable.on('data', (data) => {
      this.handleData(data);
    });
  }
  send(command, args) {
    return new Promise((completeDispatch, errorDispatch) => {
      this.doSend(command, args, (result) => {
        if (result.success) {
          completeDispatch(result);
        }
        else {
          errorDispatch(new Error(result.message));
        }
      });
    });
  }
  doSend(command, args, clb) {
    const request = {
      type: 'request',
      seq: this.sequence++,
      command: command
    };
    if (args && Object.keys(args).length > 0) {
      request.arguments = args;
    }
    // store callback for this request
    this.pendingRequests.set(request.seq, clb);
    const json = JSON.stringify(request);

    // console.log('request', JSON.stringify(request, null, 2));

    this.outputStream.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`, 'utf8');
  }
  handleData(data) {
    this.rawData = Buffer.concat([this.rawData, data]);
    while (true) {
      if (this.contentLength >= 0) {
        if (this.rawData.length >= this.contentLength) {
          const message = this.rawData.toString('utf8', 0, this.contentLength);
          this.rawData = this.rawData.slice(this.contentLength);
          this.contentLength = -1;
          if (message.length > 0) {
            this.dispatch(message);
          }
          continue; // there may be more complete messages to process
        }
      }
      else {
        const idx = this.rawData.indexOf(ProtocolClient.TWO_CRLF);
        if (idx !== -1) {
          const header = this.rawData.toString('utf8', 0, idx);
          const lines = header.split('\r\n');
          for (let i = 0; i < lines.length; i++) {
            const pair = lines[i].split(/: +/);
            if (pair[0] === 'Content-Length') {
              this.contentLength = +pair[1];
            }
          }
          this.rawData = this.rawData.slice(idx + ProtocolClient.TWO_CRLF.length);
          continue;
        }
      }
      break;
    }
  }
  dispatch(body) {
    const rawData = JSON.parse(body);
    // console.log('response', rawData);
    if (typeof rawData.event !== 'undefined') {
      const event = rawData;
      // /break/.test(event.event) && console.log(event);
      // !/load/.test(event.event) && console.log(event.event);
      this.emit(event.event, event);
    }
    else {
      const response = rawData;
      const clb = this.pendingRequests.get(response.request_seq);
      if (clb) {
        this.pendingRequests.delete(response.request_seq);
        clb(response);
      }
    }
  }
}
ProtocolClient.TWO_CRLF = '\r\n\r\n';
exports.ProtocolClient = ProtocolClient;