/**
 * Created by yangyxu on 8/20/14.
 */
zn.define([
    'node:chokidar',
    'node:fs',
    'node:ioredis',
    './Scanner',
    './RequestAcceptor',
    '../../session/SessionManager'
], function (chokidar, fs, ioredis, Scanner, RequestAcceptor, SessionManager) {

    var CONFIG = {
        PLUGIN: 'zn.plugin.config.js',
        SERVER: 'zn.server.config.js',
        APP: 'zn.app.config.js'
    };

    return zn.Class({
        events: ['init', 'loading', 'loaded'],
        statics: {
            getContext: function (inArgs) {
                return new this(inArgs);
            }
        },
        properties: {
            uuid: null,
            config: null,
            root: null,
            prefix: null,
            webPath: null,
            serverPath: null
            //requestAcceptor: null
        },
        methods: {
            init: function (args){
                var _config = args.config;
                this.sets(args);
                zn.SERVER_PATH = this._serverPath;
                zn.WEB_PATH = this._webPath;
                this.on('init', _config.onInit || zn.idle);
                this.on('loading', _config.onLoading || zn.idle);
                this.on('loaded', _config.onLoaded || zn.idle);
                this._apps = {};
                this._routers = {};
                this._uuid = zn.uuid();
                this._prefix = _config.prefix || '@';
                this._root = 'http://' + _config.host + ":" + _config.port;
                this._sessionManager = new SessionManager(_config.session);
                this._scanner = new Scanner(this);
                this._requestAcceptor = new RequestAcceptor(this);
                this.__scanWebPath();
            },
            accept: function (serverRequest, serverResponse){
                this._requestAcceptor.accept(serverRequest, serverResponse);
            },
            matchRouter: function (url){

            },
            registerApplication: function (app){
                if(!app){ return }
                var _deploy = app._deploy;
                var _app = this._apps[_deploy];
                if(_app){
                    zn.extend(app._routers, _app._routers);
                } else {
                    this._apps[_deploy] = app;
                }

                zn.extend(this._routers, app._routers);

                //console.log(Object.keys(this._routers));
                //app.fire('register', this);
                zn.info('Register Project(Application): ' + _deploy);
            },
            __scanWebPath: function (){
                var _config = this._config,
                    _webPath = this._webPath;

                if(fs.existsSync(_webPath + CONFIG.APP)){
                    this._scanner.scanApplication(_webPath, '', function (app){
                        this.registerApplication(app);
                        this.__onLoaded(_webPath);
                    }.bind(this));
                } else {
                    this.__scanWebRoot(this._serverPath + zn.SLASH + 'www' + zn.SLASH, function (){
                        this.__scanWebRoot(_webPath, function (){
                            this.__onLoaded(_webPath);
                        }.bind(this));
                    }.bind(this));
                }
            },
            __scanWebRoot: function (path, callback){
                var _defer = zn.async.defer(),
                    _self = this;
                this._scanner.scanWebRoot(path, function (appContext){
                    _self.registerApplication(appContext);
                }).then(function (apps){
                    zn.info('[ End ] Scanning Path(Application:' + apps.length + '):' + path);
                    callback && callback(apps);
                    _defer.resolve(apps);
                });

                return _defer.promise;
            },
            __watch: function (path){
                chokidar.watch('.', {
                    ignored: /[\/\\]\./
                }).on('raw', function(event, path, details) {
                    if(path.substr(-3, 3)=='.js'){
                        this.__scanWebPath();
                    }
                }.bind(this));
            },
            __onLoaded: function(path){
                if(path){
                    //this.__watch(path);
                }
                zn.info(this._root);
                this.fire('loaded');
            }
        }
    });

});
