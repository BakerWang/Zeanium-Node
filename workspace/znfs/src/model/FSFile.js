zn.define(function () {

    var model = zn.db.common.model;

    return zn.Model("zn_fs_file", {
        mixins: [
            model.Base,
            model.Tag,
            model.Tree,
            model.Rights
        ],
        properties: {
            type: {
                value: null,
                type: ['int', 11],
                default: '0'    //0: 分类、目录, 1: 文件
            },
            path: {
                value: null,
                type: ['varchar', 100],
                default: ''
            },
            url: {
                value: null,
                type: ['varchar', 100],
                default: ''
            },
            tempTitle: {
                value: null,
                type: ['varchar', 100],
                default: ''
            },
            specialTitle: {
                value: null,
                type: ['varchar', 100],
                default: ''
            },
            fileSuffix: {
                value: null,
                type: ['varchar', 100],
                default: ''
            },
            size: {
                value: null,
                type: ['float', 4],
                default: 0
            }
        }
    });

})
