/**
 * Created by yangyxu on 8/20/14.
 */
zn.define([
    '../../templete/html/exports.js',
    './config/mime',
    'node:fs',
    'node:path'
], function (html, mime, fs, path) {

    var CONTENT_TYPE = {
        'DEFAULT': 'text/plain;charset=UTF-8',
        'HTML':'text/html;charset=UTF-8',
        'XML': 'text/xml;charset=UTF-8',
        'JSON':'application/json;charset=UTF-8',
        'JAVASCRIPT': 'text/javascript;charset=UTF-8'
    };

    var _slice = Array.prototype.slice;

    var _htmlRender = new html.Render();

    return zn.Class({
        events: ['end', 'finish', 'timeout'],
        properties: {
            request: null,
            contentType: 'JSON',
            context: null,
            applicationContext: {
                value: null,
                get: function (){
                    return this._applicationContext;
                },
                set: function (value){
                    if(value){
                        this._applicationContext = value;
                        this.request.applicationContext = value;
                    }
                }
            },
            serverResponse: {
                value: null,
                get: function (){
                    return this._serverResponse;
                },
                set: function (value){
                    if(!value){ return; }
                    this._serverResponse = value;
                    this._beginTimestamp = (new Date()).getTime();
                    value.on('timeout', function (){
                        this.fire('timeout', this);
                    }.bind(this));
                    value.on('finish', function (){
                        this._endTimestamp = (new Date()).getTime();
                        this.fire('finish', this);
                    }.bind(this));
                }
            }
        },
        methods: {
            init: function (context, request){
                this._context = context;
                this._request = request;
            },
            getTimestamp: function (){
                return this._endTimestamp - this._beginTimestamp;
            },
            writeHead: function (httpStatus, inArgs){
                var _self = this,
                    _args = inArgs || {},
                    _session = this._request._session;
                var _crossSetting = {
                    'Access-Control-Allow-Origin': this._request._serverRequest.headers.origin,
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
                    'Access-Control-Allow-Headers': 'Accept,Accept-Charset,Accept-Encoding,Accept-Language,Connection,Content-Type,Cookie,DNT,Host,Keep-Alive,Origin,Referer,User-Agent,X-CSRF-Token,X-Requested-With',
                    "Access-Control-Allow-Credentials": true,
                    'Access-Control-Max-Age': '3600',//一个小时时间
                    'X-Powered-By': 'zeanium-node@1.2.0',
                    'Content-Type': 'application/json;charset=utf-8'
                };

                _args = zn.overwrite(_args, {
                    'Server-Version': _self.__getServerVersion(),
                    'Content-Type': _self.__getContentType()
                }, _crossSetting);

                if(_session){
                    if(_session.hasItem()){
                        _args['Set-Cookie'] = this._request._session.serialize();
                    } else {
                        this._context._sessionManager.remove(_session.getId());
                    }
                }

                this._request.clearTempFiles();
                this._serverResponse.writeHead(httpStatus, _args);
            },
            setTimeout: function (timeout){
                var _timeout = timeout || this._context._config.timeout || 12000;
                this._serverResponse.setTimeout(_timeout, function (){
                    this.error('Error: Request handler timeout.');
                }.bind(this));

                return this;
            },
            write: function(inData, inEncode){
                try {
                    if(this._serverResponse.finished){
                        return;
                    }
                    var _req = this._request;
                    var _callback = _req.getValue('callback'),
                        _data = inData||'';
                    if(typeof _data === 'object'){
                        _data = JSON.stringify(inData, null, '    ');
                    }

                    if(_callback){
                        _data = _callback+'('+_data+')';
                        this.contentType = 'JAVASCRIPT';
                    }
                    this.writeHead(200, {
                        'Content-Type': CONTENT_TYPE[this.contentType]
                    });
                    this._serverResponse.write(_data, inEncode);
                    zn._request = null;
                    zn._response = null;
                } catch (err) {
                    zn.error('Response write error: ' + JSON.stringify(err));
                }
            },
            writeContent: function (status, content, contentType){
                contentType = (contentType||'.html').toLowerCase();
                var _encode = (contentType=='.html'||contentType=='.htm') ? 'utf8' : 'binary';
                this.writeHead(status, {
                    "Content-Type": mime[contentType]||'text/plain',
                    "Content-Length": Buffer.byteLength(content, _encode)
                });
                this._serverResponse.write(content, _encode);
                this.end();
            },
            writePath: function (_path, _encoding){
                _path = path.normalize(_path).split('?')[0];
                if(fs.existsSync(_path)){
                    fs.readFile(_path, _encoding, function(err, content){
                        var _ext = _path.split('.').pop();
                        if(err){
                            this.viewModel('_error', {
                                code: 500,
                                msg: '服务器错误 Error: ' + err.message,
                                detail: ''
                            }, true);
                        }else {
                            this.writeContent(200, content, '.' + _ext);
                        }
                    }.bind(this));
                } else {
                    this.doIndex();
                }
            },
            writeURL: function (url, encoding){
                this.writePath(this.__fixBasePath() + url, encoding || 'binary');
            },
            doIndex: function (){
                var _basePath = this.__fixBasePath();
                    _mode = null,
                    _path = null;

                if(this._applicationContext){
                    _mode = this._applicationContext._config.mode;
                    _basePath = _basePath + this._request._uri;
                } else {
                    _basePath = _basePath + this._request.url;
                }
                _basePath = path.normalize(_basePath);
                if(!_mode){
                    _mode = this._context._config.mode;
                }

                if(_mode=='catalog'){
                    this.doCatalog(_basePath);
                } else {
                    zn.each(this._context._config.indexs || [], function (index){
                        if(fs.existsSync(_basePath + index)){
                            _path = _basePath + index;
                            return false;
                        }
                    });
                    if(_path){
                        this.writePath(_path);
                    } else {
                        if(!this._context._config.debug){
                            _basePath = this._request.url;
                        }
                        this.viewModel('_error', {
                            code: 404,
                            msg: '未找到资源文件: ' + _basePath,
                            detail: ''
                        }, true);
                    }
                }
            },
            doCatalog: function (src){
                var _baseURL = path.normalize(this.request._pathname + zn.SLASH);
                var _dirPath = src || this.__fixBasePath();
                if(!fs.statSync(_dirPath).isDirectory()){
                    if(fs.existsSync(_dirPath)){
                        this.writePath(_dirPath);
                    }else {
                        this.viewModel('_error', {
                            code: 404,
                            msg: '未找到资源文件: ' + _dirPath,
                            detail: ''
                        }, true);
                    }
                    return;
                }
                fs.readdir(_dirPath, function(err, files){
                    if(err){
                        this.viewModel('_error', {
                            code: 500,
                            msg: '服务器错误 Error: ' + err.message,
                            detail: ''
                        }, true);
                    }else {
                        files = files.map(function(file){
                            if(fs.statSync(path.join(src, file)).isDirectory()){
                                file = path.basename(file) + zn.SLASH;
                            }else{
                                file = path.basename(file);
                            }
                            return {
                                href: _baseURL + file,
                                name: file
                            };
                        });
                        this.viewModel('_catalog', {
                            files: files,
                            title: _baseURL
                        }, true);
                    }
                }.bind(this));
            },
            end: function () {
                this._serverResponse.end();
                this.fire('end', this);
            },
            writeEnd: function (inData, inEncode){
                this.write(inData, inEncode);
                this.end();
            },
            success: function (inData, inEncode){
                this.__writeJson({
                    result: inData,
                    status: 200
                }, inEncode);
            },
            error: function (inData, inEncode){
                this.writeHead(500,{});
                this.__writeJson({
                    result: inData,
                    status: 500
                }, inEncode);
            },
            sessionTimeout: function (inData, inEncode){
                this.writeHead(401,{});
                this.__writeJson({
                    result: inData,
                    status: 401
                }, inEncode);
            },
            forword: function (url, isInternal){
                this.fire('end', this);
                var _serverRequest = this.request._serverRequest,
                    _serverResponse = this._serverResponse;
                if(isInternal!==false && this.applicationContext){
                    url = zn.SLASH + this.applicationContext.deploy + zn.SLASH + url;
                }
                _serverRequest.url = path.normalize(url);
                this._context.accept(_serverRequest, _serverResponse);
            },
            redirect: function (url){
                this._serverResponse.statusCode = 302;
                this._serverResponse.setHeader("Location", url);
                this.end();
            },
            viewModel: function (view, model, isServerView){
                var _response = this;
                this._isServerView = isServerView;
                zn.extend(model, this._context.gets());
                if(this.applicationContext){
                    zn.extend(model, this.applicationContext.gets());
                }
                _htmlRender.sets({
                    templete: view,
                    templeteConvert: this.__getTempletePath.bind(this),
                    data: model
                });
                _htmlRender.toRender(function (data){
                    _response.writeContent(200, data, '.html');
                });
            },
            __getTempletePath: function (view){
                var _view = {
                    absolutePath: zn.SERVER_PATH,
                    path: '/view/',
                    suffix: 'html'
                };

                if(!this._isServerView && this.applicationContext){
                    var _config = this.applicationContext._config;
                    _view = _config.views || _config.view || _view;
                    _view.absolutePath = _config.root;
                }

                if(view.indexOf('.') === -1){
                    view += '.' + _view.suffix;
                }

                return _view.absolutePath + _view.path + view;
            },
            __writeJson: function (inData, inEncode){
                inData.version = this.__getServerVersion();
                //this.contentType = 'JSON';
                this.writeEnd(inData, inEncode);
            },
            __getContentType: function (type){
                return CONTENT_TYPE[type||this.contentType];
            },
            __getServerVersion: function (){
                return 'Zeanium-Server V1.0.0';
            },
            __fixBasePath: function (){
                var _basePath = null;
                if(this._applicationContext){
                    _basePath = this._applicationContext._config.root;
                } else if(this._context) {
                    _basePath = this._context._webPath;
                }

                return _basePath + zn.SLASH;
            }
        }
    });

});
