

def get_allergies(menu, allergic_to):
    
    safe_to_eat = []
    unsafe_to_eat = []
    
    for item in menu:
        allergens = item['allergens']
        
        if not allergic_to or not allergens:
            safe_to_eat.append(item)
            continue
         
    
        # Gets the intersection of allergens user is allergic to and allergens detected in food
        allergen_in_common = list(set(allergic_to) & set(allergens))
        if allergen_in_common:
            print("*** Allergen detected: ", allergen_in_common)
            unsafe_to_eat.append(item)
        else:
            safe_to_eat.append(item)
        
    print("*** safe_to_eat: ", safe_to_eat)
    print("*** NOT safe_to_eat: ", unsafe_to_eat)
    
    return {
        "safe": safe_to_eat,
        "unsafe": unsafe_to_eat
    }
            
        