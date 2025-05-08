const shippingAddressController = require('../../controllers/order/shippingAddressController');
const router = require('express').Router();

// Get saved addresses for a user
router.get('/saved-addresses/:userId', shippingAddressController.getSavedAddresses);

// Save new address
router.post('/save-address', shippingAddressController.saveAddress);

// Update address
router.put('/update-address/:addressId', shippingAddressController.updateAddress);

// Delete address
router.delete('/delete-address/:addressId', shippingAddressController.deleteAddress);

// Set default address
router.put('/set-default-address/:addressId', shippingAddressController.setDefaultAddress);

module.exports = router; 