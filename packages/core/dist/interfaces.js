export var PlatformType;
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
})(PlatformType || (PlatformType = {}));
export var PlayerStateEnum;
(function (PlayerStateEnum) {
    PlayerStateEnum["IDLE"] = "idle";
    PlayerStateEnum["LOADING"] = "loading";
    PlayerStateEnum["READY"] = "ready";
    PlayerStateEnum["PLAYING"] = "playing";
    PlayerStateEnum["PAUSED"] = "paused";
    PlayerStateEnum["BUFFERING"] = "buffering";
    PlayerStateEnum["ENDED"] = "ended";
    PlayerStateEnum["ERROR"] = "error";
})(PlayerStateEnum || (PlayerStateEnum = {}));
export { PlayerStateEnum as PlayerState };
export var DRMType;
(function (DRMType) {
    DRMType["FAIRPLAY"] = "fairplay";
    DRMType["WIDEVINE"] = "widevine";
    DRMType["PLAYREADY"] = "playready";
    DRMType["CLEARKEY"] = "clearkey";
})(DRMType || (DRMType = {}));
//# sourceMappingURL=interfaces.js.map