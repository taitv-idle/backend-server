/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if phone number is valid
 */
exports.validatePhoneNumber = (phone) => {
    // Vietnamese phone number format
    // Mobile: 09xxxxxxx, 03xxxxxxx, 07xxxxxxx, 08xxxxxxx
    // Landline: 02xxxxxxx
    const phoneRegex = /^(0[2|3|7|8|9])+([0-9]{8})$/;
    return phoneRegex.test(phone);
}; 