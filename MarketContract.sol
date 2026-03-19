// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Marketplace is ERC721 {
    enum Categories {
        IT,
        Drug,
        Weapon,
        Credentials,
        Misc
    }

    struct Product {
        uint id;
        bytes32 name;
        uint price;
        uint stock;
        address seller;
        Categories category;
        bytes32 ipfsCID; // IPFS CID of recipe/content
        bytes32 contentHash; // keccak256 hash of content for integrity
    }

    struct Receipt {
        uint productId;
        bytes32 contentHash;
    }

    mapping(uint => Product) private products;
    uint[] private productsID;

    mapping(uint => uint) private indexOf;
    mapping(uint => bool) private exists;

    mapping(Categories => uint[]) private productsByCategory;
    mapping(uint => uint) private categoryIndexOf;

    mapping(uint => Receipt) public receipts;

    uint private productID = 0;
    uint public nextTokenId = 0;
    address public admin;

    constructor() ERC721("MarketplaceReceipt", "MPR") {
        admin = msg.sender;
    }

    // Function to add a product to the marketplace
    // Used by : sellers to list their products for sale
    // Validations:
    // - Price must be greater than 0
    // - Stock must be greater than 0
    // Parameters:
    // - _name: Name of the product
    // - _price: Price of the product in wei
    // - _stock: Initial stock quantity of the product
    // - _categoryID: ID of the category to which the product belongs
    // - _ipfsCID: IPFS CID where the product content/recipe is stored
    // - _contentHash: keccak256 hash of the product content for integrity verification
    function addProduct(
        string memory _name,
        uint _price,
        uint _stock,
        uint _categoryID,
        string memory _ipfsCID,
        bytes32 _contentHash
    ) public {
        require(_price > 0, "Price must be > 0");
        require(_stock > 0, "Stock must be > 0");

        Categories _category = Categories(_categoryID);

        Product memory p = Product(
            productID,
            _stringToBytes32(_name),
            _price,
            _stock,
            msg.sender,
            _category,
            _stringToBytes32(_ipfsCID),
            _contentHash
        );

        products[productID] = p;

        productsID.push(productID);
        indexOf[productID] = productsID.length - 1;
        exists[productID] = true;

        productsByCategory[_category].push(productID);
        categoryIndexOf[productID] = productsByCategory[_category].length - 1;

        productID++;
    }

    // Function to buy a product from the marketplace
    // Used by : buyers to purchase products listed on the marketplace
    // Validations:
    // - Product must exist
    // - Payment must match product price
    // - Product must be in stock
    // Parameters:
    // - _id: ID of the product to purchase
    // Process:
    // - Transfer payment to seller
    // - Mint an NFT receipt to the buyer with product details
    function buyProduct(uint _id) public payable {
        require(exists[_id], "Product not available");

        Product storage p = products[_id];

        require(msg.value == p.price, "Incorrect payment");
        require(p.stock > 0, "Out of stock");

        address payable seller = payable(p.seller);
        (bool sent, ) = seller.call{value: msg.value}("");
        require(sent, "Payment failed");

        // Mint NFT receipt
        uint tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);

        receipts[tokenId] = Receipt({
            productId: _id,
            contentHash: p.contentHash
        });

        p.stock--;

        if (p.stock == 0) {
            _removeProduct(_id);
        }
    }

    // Function to delete a product from the marketplace
    // Used by : product creator (seller) or admin
    // Validations:
    // - Product must exist
    // - Caller must be product seller or admin
    // Parameters:
    // - _id: ID of the product to delete
    function deleteProduct(uint _id) public {
        require(exists[_id], "Product not available");

        Product storage p = products[_id];
        require(
            msg.sender == p.seller || msg.sender == admin,
            "Not authorized"
        );

        _removeProduct(_id);
    }

    // Function to verify the integrity of the product content using the receipt
    // Used by : buyers to verify that the content they received matches what was listed
    // Validations:
    // - Receipt must exist for the given tokenId
    // Parameters:
    // - tokenId: ID of the NFT receipt to verify
    // - hashToCheck: keccak256 hash of the content to compare against the receipt
    function verifyContent(
        uint tokenId,
        bytes32 hashToCheck
    ) public view returns (bool) {
        return receipts[tokenId].contentHash == hashToCheck;
    }

    // Function to get all products listed on the marketplace
    // Used by : anyone to view the available products for sale
    // Parameters:
    // - None
    // Returns:
    // - Array of all products listed on the marketplace
    function getProducts() public view returns (Product[] memory) {
        Product[] memory p = new Product[](productsID.length);
        for (uint i = 0; i < productsID.length; i++) {
            p[i] = products[productsID[i]];
        }
        return p;
    }

    // Helper function to convert string to bytes32 due to Solidity's limitations with string handling in structs after version 0.8.0
    function _stringToBytes32(
        string memory source
    ) internal pure returns (bytes32 result) {
        bytes memory temp = bytes(source);
        if (temp.length == 0) return 0x0;
        assembly {
            result := mload(add(source, 32))
        }
    }

    // Function to get products by category
    // Used by : anyone to filter products based on their category
    // Parameters:
    // - _categoryID: ID of the category to filter products by
    // Returns:
    // - Array of products that belong to the specified category
    function getProductsByCategories(
        uint _categoryID
    ) public view returns (Product[] memory) {
        Categories _category = Categories(_categoryID);
        uint[] memory list = productsByCategory[_category];
        Product[] memory p = new Product[](list.length);
        for (uint i = 0; i < list.length; i++) {
            p[i] = products[list[i]];
        }
        return p;
    }

    // Function to get all categories with their corresponding enum values
    // Used by : anyone to understand the available categories and their enum mappings
    // Parameters:
    // - None
    // Returns:
    // - Array of category names and their corresponding enum values
    function getAllCategoriesWithNames()
        public
        pure
        returns (bytes32[] memory, Categories[] memory)
    {
        bytes32[] memory names = new bytes32[](5);
        Categories[] memory values = new Categories[](5);

        names[0] = "IT";
        names[1] = "Drug";
        names[2] = "Weapon";
        names[3] = "Credentials";
        names[4] = "Misc";

        values[0] = Categories.IT;
        values[1] = Categories.Drug;
        values[2] = Categories.Weapon;
        values[3] = Categories.Credentials;
        values[4] = Categories.Misc;

        return (names, values);
    }

    // Internal function to remove a product from the marketplace when stock reaches 0
    // Used by : buyProduct to maintain the marketplace listings when a product is sold out
    function _removeProduct(uint _id) internal {
        uint index = indexOf[_id];
        uint lastIndex = productsID.length - 1;
        uint lastId = productsID[lastIndex];

        productsID[index] = lastId;
        indexOf[lastId] = index;
        productsID.pop();

        _removeFromCategory(_id);

        delete indexOf[_id];
        delete exists[_id];
        delete products[_id];
    }

    // Internal function to remove a product from its category listing when stock reaches 0
    // Used by : _removeProduct to maintain category listings when a product is removed from the marketplace
    function _removeFromCategory(uint _id) internal {
        Product storage p = products[_id];
        Categories cat = p.category;

        uint index = categoryIndexOf[_id];
        uint lastIndex = productsByCategory[cat].length - 1;
        uint lastId = productsByCategory[cat][lastIndex];

        productsByCategory[cat][index] = lastId;
        categoryIndexOf[lastId] = index;

        productsByCategory[cat].pop();

        delete categoryIndexOf[_id];
    }

    // Function to get the index of a product in the productsID array
    // Used by : internal functions to manage product listings and removals
    // Parameters:
    // - _id: ID of the product to get the index for
    // Returns:
    // - Index of the product in the productsID array, or -1 if it does not exist
    function getIndex(uint _id) public view returns (int) {
        if (!exists[_id]) return -1;
        return int(indexOf[_id]);
    }
}
