const mongoose = require('mongoose');
const { statusCode, resMessage } = require("../config/constants");
const Businessprofile = require('../models/BusinessProfile');
const { getBusinessData, createProductCatalog } = require('../functions/functions');
const Catalog = require('../models/Catalog');

exports.create = async (req) => {
    try {
        const { businessProfileId } = req.params;
        const { name } = req.body;

        if (!mongoose.Types.ObjectId.isValid(businessProfileId)) {
            return { 
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Invalid_business_ID
            };
        }

        const isMetaId = await Businessprofile.findOne({ _id: businessProfileId, userId: req.user._id, tenantId: req.tenant._id });
        if(!isMetaId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_not_found
            }
        }
        const checkMetaId = await getBusinessData(isMetaId.metaId, isMetaId.metaAccessToken);
        if(checkMetaId?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: checkMetaId?.error?.message
            }
        }
        const existingCatalog = await Catalog.findOne({ businessProfileId });
        if (existingCatalog && !existingCatalog.userId.equals(req.user._id)) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_already_linked
            }
        }
        const catalogData = await createProductCatalog(isMetaId.metaId, name, isMetaId.metaAccessToken);
        if(catalogData?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: catalogData?.error?.message
            }
        }
        await Catalog.create({
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId,
            catalogId: catalogData.id,
            name
        })
        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Catalog_created
        }
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
}