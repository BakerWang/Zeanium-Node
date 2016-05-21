/**
 * Created by yangyxu on 9/17/14.
 */
zn.define([
    '../mysql/MySqlCommand',
    '../sql/Transaction',
    'node:mysql'
],function (MySqlCommand, Transaction, mysql) {

    var Store = zn.Class('zn.db.data.Store', {
        statics: {
            getStore: function (config) {
                return new this(config);
            }
        },
        properties: {
            command: {
                readonly: true,
                get: function (){
                    return new this._commandClass(this._pool);
                }
            }
        },
        methods: {
            init: {
                auto: true,
                value: function (inConfig){
                    this._config = inConfig || {};
                    switch (inConfig.type.toLowerCase()) {
                        case 'mysql':
                            this._pool = mysql.createPool(zn.extend({
                                "dateStrings": true,
                                "multipleStatements": true
                            }, inConfig));
                            this._commandClass = MySqlCommand;
                            break;
                        case 'mongo':

                            break;
                    }
                }
            },
            beginTransaction: function (){
                return (new Transaction(this._pool)).begin();
            },
            setDataBase: function (value){
                this._config.database = value;
            },
            create: function (name){
                return this.query('CREATE DATABASE ' + name);
            },
            drop: function (){
                return this.query('DROP DATABASE ' + name);
            },
            show: function (){
                return this.query('SHOW DATABASES;');
            },
            query: function (sql){
                return this.command.query(sql);
            },
            createModel: function (inModelClass) {
                var _defer = zn.async.defer();
                this.command.query(inModelClass.getCreateSql())
                    .then(function (data, command){
                        _defer.resolve(data);
                        command.release();
                    });

                return _defer.promise;
            }
        }
    });

    zn.Store = Store;

    return Store;

});
