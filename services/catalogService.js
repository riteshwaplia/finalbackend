const mongoose = require('mongoose');
const { statusCode, resMessage } = require("../config/constants");
const Businessprofile = require('../models/BusinessProfile');
const { getBusinessData, createProductCatalog, getOwnedProductCatalogs } = require('../functions/functions');
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

exports.catalogList = async (req) => {
    try {
        const { businessProfileId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(businessProfileId)) {
            return { 
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Invalid_business_ID
            };
        }

        const isMetaId = await Businessprofile.findOne({ 
            _id: businessProfileId, 
            userId: req.user._id, 
            tenantId: req.tenant._id 
        });
        if (!isMetaId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_not_found
            };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const data = await Catalog.find({ 
            businessProfileId: businessProfileId, 
            userId: req.user._id, 
            tenantId: req.tenant._id 
        })
        .skip(skip)
        .limit(Number(limit));

        const totalRecords = await Catalog.countDocuments({
            businessProfileId, 
            userId: req.user._id, 
            tenantId: req.tenant._id 
        });

        if (!data || data.length === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }

        return {
            data,
            pagination: {
                totalRecords,
                currentPage: Number(page),
                totalPages: Math.ceil(totalRecords / Number(limit)),
                pageSize: Number(limit)
            },
            status: statusCode.OK,
            success: true,
            message: resMessage.Data_fetch_successfully
        };

    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
};