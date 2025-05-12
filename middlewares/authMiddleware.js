const jwt = require('jsonwebtoken');

module.exports.authMiddleware = async(req, res, next) =>{
    const {accessToken} = req.cookies

    if (!accessToken) {
        return res.status(409).json({ error : 'Please Login First'})
    } else {
        try {
            const deCodeToken = await jwt.verify(accessToken,process.env.SECRET)
            req.role = deCodeToken.role
            req.id = deCodeToken.id
            next()            
        } catch (error) {
            return res.status(409).json({ error : 'Please Login'})
        }        
    }
}

module.exports.customerAuthMiddleware = async(req, res, next) =>{
    const {customerToken} = req.cookies

    if (!customerToken) {
        return res.status(409).json({ error : 'Please Login First'})
    } else {
        try {
            const deCodeToken = await jwt.verify(customerToken, process.env.SECRET)
            req.user = deCodeToken
            next()            
        } catch (error) {
            return res.status(409).json({ error : 'Please Login'})
        }        
    }
}

module.exports.adminAuthMiddleware = async(req, res, next) =>{
    const {accessToken} = req.cookies

    if (!accessToken) {
        return res.status(409).json({ error : 'Please Login First'})
    } else {
        try {
            const deCodeToken = await jwt.verify(accessToken, process.env.SECRET)
            
            if (deCodeToken.role !== 'admin') {
                return res.status(403).json({ error : 'Không đủ quyền truy cập. Chỉ có admin mới được phép sử dụng chức năng này.'})
            }
            
            req.id = deCodeToken.id
            req.role = deCodeToken.role
            next()            
        } catch (error) {
            return res.status(409).json({ error : 'Please Login or Session Expired'})
        }        
    }
}