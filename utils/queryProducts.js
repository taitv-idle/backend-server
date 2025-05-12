class queryProducts {
    products = []
    query = {}
    constructor(products,query){
        this.products = products
        this.query = query
    }

    // Hàm chuyển đổi chuỗi thành không dấu
    removeDiacritics = (str) => {
        return str.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toLowerCase();
    }

    categoryQuery = () => {
        this.products = this.query.category ? this.products.filter(c => c.category === this.query.category) : this.products
        return this
    }

    ratingQuery = () => {
        this.products = this.query.rating ? this.products.filter(c => parseInt(this.query.rating) <= c.rating && c.rating < parseInt(this.query.rating) + 1) : this.products
        return this
    }

    searchQuery = () => {
        if (this.query.searchValue) {
            const searchValue = this.removeDiacritics(this.query.searchValue);
            this.products = this.products.filter(p => {
                const productName = this.removeDiacritics(p.name);
                const productCategory = this.removeDiacritics(p.category);
                const productBrand = this.removeDiacritics(p.brand);
                const productDescription = this.removeDiacritics(p.description);
                
                return productName.includes(searchValue) ||
                       productCategory.includes(searchValue) ||
                       productBrand.includes(searchValue) ||
                       productDescription.includes(searchValue);
            });
        }
        return this;
    }

    priceQuery = () => {
        this.products = this.products.filter(p => p.price >= this.query.lowPrice & p.price <= this.query.highPrice )
        return this
    }
    sortByPrice = () => {
        if (this.query.sortPrice) {
            if (this.query.sortPrice === 'low-to-high') {
                this.products = this.products.sort(function (a,b){ return a.price - b.price})
            } else {
                this.products = this.products.sort(function (a,b){ return b.price - a.price})
            }
        }
        return this
    }

    skip = () => {
        let {pageNumber} = this.query
        const skipPage = (parseInt(pageNumber) - 1) * this.query.parPage
        let skipProduct = []

        for (let i = skipPage; i < this.products.length; i++) {
            skipProduct.push(this.products[i]) 
        }
        this.products = skipProduct
        return this
    }

    limit = () => {
        let temp = []
        if (this.products.length > this.query.parPage) {
            for (let i = 0; i < this.query.parPage; i++) {
                temp.push(this.products[i]) 
            } 
        }else {
            temp = this.products
        }
        this.products = temp 
        return this
    }

    getProducts = () => {
        return this.products
    }

    countProducts = () => {
        return this.products.length
    } 

}

module.exports = queryProducts