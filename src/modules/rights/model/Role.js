zn.define(function () {

    var model = zn.db.common.model;

    return zn.model("zn_rights_role", {
        mixins: [
            model.Base,
            model.Tag
        ],
        properties: {
            code: {
                value: null,
                type: ['varchar', 100],
                default: ''
            },
            groupId: {
                value: null,
                type: ['int', 11],
                default: '0'
            },
            userIds: {
                value: null,
                type: ['varchar', 500],
                default: ','
            }
        }
    });

})
