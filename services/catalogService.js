const mongoose = require('mongoose');
const { statusCode, resMessage } = require("../config/constants");
const Businessprofile = require('../models/BusinessProfile');
const { getBusinessData, createProductCatalog, getOwnedProductCatalogs, deleteCatalogFromMeta } = require('../functions/functions');
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
        if (!isMetaId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_not_found
            }
        }
        const checkMetaId = await getBusinessData(isMetaId.metaId, isMetaId.metaAccessToken);
        if (checkMetaId?.error) {
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
        if (catalogData?.error) {
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

exports.syncCatalogs = async (req) => {
    try {
        const { businessProfileId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(businessProfileId)) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Invalid_business_ID
            };
        }

        const isMetaId = await Businessprofile.findOne({ _id: businessProfileId, userId: req.user._id, tenantId: req.tenant._id });
        if (!isMetaId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_not_found
            }
        }

        const catalogs = await getOwnedProductCatalogs(isMetaId.metaId, isMetaId.metaAccessToken);

        if (catalogs?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: catalogs?.error?.message
            };
        }

        const catalogDocs = catalogs?.data.map(item => ({
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId: businessProfileId,
            catalogId: item.id,
            name: item.name || "Untitled Catalog"
        })) || [];

        if (catalogDocs.length === 0) {
            await Catalog.deleteMany({
                userId: req.user._id,
                tenantId: req.tenant._id,
                businessProfileId: businessProfileId
            });

            return {
                status: statusCode.SUCCESS,
                success: true,
                message: resMessage.Catalog_sync_successfully
            };
        }

        const existingCatalogs = await Catalog.find({
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId: businessProfileId
        }).distinct("catalogId");

        const metaCatalogIds = catalogDocs.map(c => c.catalogId);

        const newCatalogs = catalogDocs.filter(c => !existingCatalogs.includes(c.catalogId));

        const catalogsToDelete = existingCatalogs.filter(id => !metaCatalogIds.includes(id));

        if (newCatalogs.length > 0) {
            await Catalog.insertMany(newCatalogs);
        }

        if (catalogsToDelete.length > 0) {
            await Catalog.deleteMany({
                catalogId: { $in: catalogsToDelete },
                userId: req.user._id,
                tenantId: req.tenant._id,
                businessProfileId: businessProfileId
            });
        }

        return {
            status: statusCode.SUCCESS,
            success: true,
            message: resMessage.Catalog_sync_successfully,
            data: {
                newCatalogsAdded: newCatalogs.length,
                catalogsDeleted: catalogsToDelete.length
            }
        };

    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
};

exports.deleteCatalog = async (req, res) => {
    try {
        const { catalogId } = req.params;

        const catalogData = await Catalog.findOne({
            _id: catalogId,
            tenantId: req.tenant._id,
            userId: req.user._id
        }).populate("businessProfileId", "metaAccessToken metaId");

        if (!catalogData) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Catalog_id_not_found
            }
        }

        const result = await deleteCatalogFromMeta(catalogData.catalogId, catalogData.businessProfileId.metaAccessToken, catalogData.businessProfileId.metaId);

        if (result?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: result?.error?.message
            };
        }

        await Catalog.findByIdAndDelete(catalogId);

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Catalog_deleted
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Server error"
        });
    }
};