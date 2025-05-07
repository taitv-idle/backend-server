const createSlug = async (str, model, existingId = null) => {
    let slug = str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/\b(a|an|the|and|or|of)\b/g, '')
        .slice(0, 60)
        .replace(/-+$/, '');

    let count = 1
    const baseSlug = slug
    
    while (true) {
        const existing = await model.findOne({ 
            slug,
            _id: { $ne: existingId }
        })
        
        if (!existing) break
        slug = `${baseSlug}-${count++}`
    }

    return slug;
}

module.exports = { createSlug }