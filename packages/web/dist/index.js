"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.SecureVideoPlayer = exports.WebPlayerView = exports.WebPlayer = void 0;
__exportStar(require("../../core/dist"), exports);
var WebPlayer_1 = require("./WebPlayer");
Object.defineProperty(exports, "WebPlayer", { enumerable: true, get: function () { return WebPlayer_1.WebPlayer; } });
var WebPlayerView_1 = require("./react/WebPlayerView");
Object.defineProperty(exports, "WebPlayerView", { enumerable: true, get: function () { return WebPlayerView_1.WebPlayerView; } });
var SecureVideoPlayer_1 = require("./SecureVideoPlayer");
Object.defineProperty(exports, "SecureVideoPlayer", { enumerable: true, get: function () { return SecureVideoPlayer_1.SecureVideoPlayer; } });
exports.VERSION = '1.0.0';
//# sourceMappingURL=index.js.map