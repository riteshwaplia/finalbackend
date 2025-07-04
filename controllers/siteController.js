const getSiteConfig = async (req, res) => {
    // req.tenant is already populated by tenantResolver middleware
    if (!req.tenant) {
        return res.status(404).json({ message: 'Site configuration not found for this domain.' });
    }

    // Return only necessary public config data
    res.json({
        websiteName: req.tenant.websiteName,
        faviconUrl: req.tenant.faviconUrl,
        _id: req.tenant._id,
        // Add other public branding/config fields here
    });
};

module.exports = { getSiteConfig };