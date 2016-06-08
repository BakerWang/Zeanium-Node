/**
 * Created by yangyxu on 8/20/14.
 */
zn.define([
    'node:url',
    'node:path',
    'node:fs',
    'node:formidable'
],function (url, path, fs, formidable) {

    return zn.Class({
        events: [ 'data', 'end', 'close' ],
        properties: {
            paths: null,
            $data: null,
            $post: null,
            $get: null,
            $files: null,
            context: null,
            applicationContext: null,
            chain: null,
            serverRequest: {
                value: null,
                get: function (){
                    return this._serverRequest;
                },
                set: function (value){
                    if(!value){ return false; }
                    this._serverRequest = value;
                    this._errors = [];
                    this._cookie = this.__parseCookie(value.headers.cookie);
                    this.__parseUrlData();
                    //this.__parseRequest();
                }
            }
        },
        methods: {
            init: function (context, serverRequest){
                this._$data = {};
                this._$post = {};
                this._$get = {};
                this._$files = {};
                this._errors = [];
                this._context = context;
                this.serverRequest = serverRequest;
            },
            getValue: function (inName) {
                return this._$data[inName];
            },
            setValue: function (inKey, inValue){
                return this._$data[inKey] = inValue, this;
            },
            getErrorMessage: function (){
                return this._errors.join('\n');
            },
            setErrorMessage: function (inValue){
                return this._errors.push(inValue.toString()), this;
            },
            getInt: function (inName) {
                return +(this.getValue(inName));
            },
            getBoolean: function (inName) {
                return new Boolean(this.getValue(inName)).valueOf();
            },
            checkArgs: function (args, response){
                var _defaultValue = null,
                    _newValue = null,
                    _values = zn.extend({}, this._$get, this._$post);

                for(var _key in args){
                    _defaultValue = args[_key];
                    _newValue = _values[_key];

                    if (_defaultValue === undefined && _newValue === undefined){
                        response.error('The value of ' + _key + ' is Required.');
                        return false;
                    }

                    if(zn.type(_defaultValue)=='object'){
                        var _value = _defaultValue.value,
                            _reg = _defaultValue.regexp;

                        if(!_reg.test(_value)){
                            response.error('The value of ' + _key + ' is Invalid.');
                            return false;
                        }
                    }

                    if(_newValue === undefined && _defaultValue){
                        _values[_key] = _defaultValue;
                    }
                }

                return this._$data = _values, _values;
            },
            parse: function (callback){
                this.__parseFormData(callback);
            },
            __getUploadInfo: function (){
                var _config = this.applicationContext._config,
                    _upload = _config.upload || {},
                    _root = (_config.root || __dirname)+'/uploads/';

                return zn.extend(_upload, {
                    root: _root,
                    temp: 'temp/',
                    catalog: 'catalog/',
                    forward: '',
                    server: 'http://localhost:8888/tj/'
                });
            },
            __parseFormData: function (callback){
                var _request = this._serverRequest,
                    _upload = this.__getUploadInfo(),
                    _incomingForm = new formidable.IncomingForm();

                this._upload = _upload;
                _incomingForm.uploadDir = _upload.root + _upload.temp;  //文件上传 临时文件存放路径
                if(_request.data){
                    var _data = _request.data;
                    this._$post = _data.fields;
                    this._$files = _data.files;
                    callback(zn.extend({ upload: _upload }, _data));
                } else {
                    _incomingForm.parse(_request,function(error, fields, files){
                        if(error){
                            zn.error('Request.js   --  line 110 message:  formidable.IncomingForm parse error.  ' + error.toString());
                        } else {
                            _request.data = {
                                fields: fields,
                                files: files
                            };
                            this._$post = fields;
                            this._$files = files;
                            callback({ upload: _upload, fields: fields, files: files });
                        }
                    }.bind(this));
                }
            },
            uploadFile: function (file, upload){
                var _name = file.path.split(path.sep).pop(),
                    _ext = file.type.split('/').pop(),
                    _file = _name + '.' + _ext,
                    _upload = upload || this._upload,
                    _root = _upload.root;

                var _path = _root + _upload.temp + _name,
                    _newPath = _root + _upload.catalog + _file;

                _path = _path.replace(/\\/g, '/');
                _newPath = _newPath.replace(/\\/g, '/');
                fs.renameSync(_path, _newPath);

                return {
                    path: _newPath,
                    size: file.size,
                    fileType: file.type,
                    file: _file,
                    name: file.name,
                    ext: _ext,
                    url: path.normalize(_upload.server + '/' + _upload.catalog + '/' + _file),
                    lastModifiedDate: file.lastModifiedDate.toISOString().slice(0, 19)
                };
            },
            uploadFiles: function (files, upload){
                var _upload = upload || this._upload,
                    _catalog = _upload.root + _upload.catalog,
                    _self = this;

                if(!fs.existsSync(_catalog)){
                    fs.mkdirSync(_catalog, 0766);
                }

                return this.__uploadFiles(files);
            },
            __uploadFiles: function (files){
                var _paths = [];
                zn.each(files, function (file){
                    _paths.push(this.uploadFile(file));
                }, this);
                return _paths;
            },
            __parseCookie: function (cookie){
                var _data = {},
                    _temp = null,
                    _cookie = cookie || '';

                _cookie && _cookie.split(';').forEach(function(temp) {
                    _temp = temp.split('=');
                    _data[_temp.shift().trim()] = decodeURI(_temp.join('='));
                });

                return _data;
            },
            __parseRequest: function (){
                var _self = this,
                    _serverRequest = this._serverRequest;

                _serverRequest.on('data', function (data) {
                    _self.fire('data', data);
                });

                _serverRequest.on('end', function () {
                    _self.fire('end');
                });

                _serverRequest.on('close', function(callback){
                    _self.fire('close', callback);
                });
            },
            __parseUrlData: function (){
                var _req = this._serverRequest,
                    _parse = url.parse(_req.url, true),
                    _paths = _parse.pathname.split('/');

                _paths.shift();
                if(_paths[0]==''){
                    _paths.shift();
                }
                this._$get = _parse.query;
                this._paths = _paths;
                this._uri = '/'+_paths.slice(1).join('/');
                this._pathname = _parse.pathname;
                zn.extend(this, _req);
            }
        }
    });

});
