const jwt = require('jsonwebtoken');

module.exports.authMiddleware = async (req, res, next) => {
    const {accessToken} = req.cookies;
    if (!accessToken) {
        return res.status(401).json({
            message: 'Please login first'
        });
    }
    try {
        const decoded = await jwt.verify(accessToken, process.env.SECRET_KEY);
        req.role = decoded.role;
        req._id = decoded._id;

        next();
    }
    catch (error) {
        return res.status(401).json({
            error: 'Invalid token'
        });
    }
}
