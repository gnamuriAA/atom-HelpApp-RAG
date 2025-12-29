import re
import json

def parse_product_info(text):
    """
    Parse product information from the accessories PDF.
    Returns a list of product dictionaries with name, description, price, and part_number.
    """
    products = []
    
    # Strategy: Find all price + part number combinations
    # Then look backwards for description and name
    
    # Find all instances of: $price followed by part_number (alphanumeric with dash/slash)
    price_part_pattern = r'\$(\d+\.\d+)\s+([A-Z0-9/-]+(?:AM/A|LL/A)?)'
    matches = list(re.finditer(price_part_pattern, text))
    
    for match in matches:
        price = match.group(1)
        part_number = match.group(2)
        
        # Get context before this match (previous 200 chars) to find description
        start_pos = max(0, match.start() - 300)
        context_before = text[start_pos:match.start()]
        
        # Find description (usually the last line before the price)
        lines_before = context_before.split('\n')
        description = None
        name = None
        
        # Look for description (last non-empty line before price)
        for line in reversed(lines_before):
            line = line.strip()
            if line and 'DESCRIPTION' not in line and 'PRICE' not in line and 'PART NUMBER' not in line:
                if not description and len(line) > 10:
                    description = line
                # Look for product name (ALL CAPS lines)
                if line.isupper() and len(line) > 10 and 'DESCRIPTION' not in line:
                    name = line
                    break
        
        if description:
            products.append({
                'name': name if name else description[:60],
                'description': description,
                'price': f'${price}',
                'part_number': part_number
            })
    
    return products

def find_product_by_query(products, query):
    """
    Find the best matching product based on the query.
    Returns the product info or None.
    """
    query_lower = query.lower()
    
    # Direct part number match
    for product in products:
        if product['part_number'].lower() in query_lower:
            return product
    
    # Match by name/description
    best_match = None
    best_score = 0
    
    for product in products:
        score = 0
        searchable = f"{product.get('name', '')} {product['description']}".lower()
        
        # Count matching words
        query_words = re.findall(r'\w+', query_lower)
        for word in query_words:
            if len(word) > 2 and word in searchable:
                score += 1
        
        if score > best_score:
            best_score = score
            best_match = product
    
    return best_match if best_score > 0 else None

def format_product_response(product, query):
    """
    Format a natural language response for the product query.
    """
    if not product:
        return None
    
    # Check what information is being asked for
    query_lower = query.lower()
    
    response_parts = []
    
    if 'part number' in query_lower or 'part' in query_lower:
        response_parts.append(f"Part Number: {product['part_number']}")
    
    if 'price' in query_lower or 'cost' in query_lower or 'part number' in query_lower:
        response_parts.append(f"Price: {product['price']}")
    
    if not response_parts:
        # If no specific field requested, return everything
        response_parts.append(f"Part Number: {product['part_number']}")
        response_parts.append(f"Price: {product['price']}")
    
    # Add description context
    name = product.get('name', product['description'][:50])
    
    return {
        'answer': ' and '.join(response_parts),
        'product_name': name,
        'full_details': product
    }

if __name__ == "__main__":
    # Test the parser
    from HelpPDFReader import extract_text
    
    text = extract_text('ipad-accessories.pdf')
    products = parse_product_info(text)
    
    print(f"Found {len(products)} products:\n")
    for i, p in enumerate(products[:5], 1):
        print(f"{i}. {p.get('name', 'N/A')}")
        print(f"   Part: {p['part_number']}, Price: {p['price']}")
        print(f"   Desc: {p['description'][:80]}...")
        print()
    
    # Test query
    test_query = "What is the Part Number of APPLE USB-C POWER ADAPTER (GEN 10 iPAD, iPAD PRO)"
    product = find_product_by_query(products, test_query)
    response = format_product_response(product, test_query)
    
    print("\nTest Query:")
    print(f"Q: {test_query}")
    print(f"A: {response['answer']}")
