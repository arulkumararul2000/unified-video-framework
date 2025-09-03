"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRMType = exports.PlayerState = exports.PlatformType = void 0;
var PlatformType;
(function (PlatformType) {
    PlatformType["IOS"] = "ios";
    PlatformType["ANDROID"] = "android";
    PlatformType["TIZEN"] = "tizen";
    PlatformType["WEBOS"] = "webos";
    PlatformType["ROKU"] = "roku";
    PlatformType["ANDROID_TV"] = "androidtv";
    PlatformType["APPLE_TV"] = "appletv";
    PlatformType["WEB"] = "web";
    PlatformType["WINDOWS"] = "windows";
})(PlatformType = exports.PlatformType || (exports.PlatformType = {}));
var PlayerState;
(function (PlayerState) {
    PlayerState["IDLE"] = "idle";
    PlayerState["LOADING"] = "loading";
    PlayerState["READY"] = "ready";
    PlayerState["PLAYING"] = "playing";
    PlayerState["PAUSED"] = "paused";
    PlayerState["BUFFERING"] = "buffering";
    PlayerState["ENDED"] = "ended";
    PlayerState["ERROR"] = "error";
})(PlayerState = exports.PlayerState || (exports.PlayerState = {}));
var DRMType;
(function (DRMType) {
    DRMType["FAIRPLAY"] = "fairplay";
    DRMType["WIDEVINE"] = "widevine";
    DRMType["PLAYREADY"] = "playready";
    DRMType["CLEARKEY"] = "clearkey";
})(DRMType = exports.DRMType || (exports.DRMType = {}));
//# sourceMappingURL=interfaces.js.map