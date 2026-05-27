def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    for i, c in enumerate(content):
        if c == '{':
            stack.append(i)
        elif c == '}':
            if not stack:
                print(f"Extra closing brace at {i}")
                return False
            stack.pop()
            
    if stack:
        print(f"Unclosed braces at {stack}")
        return False
        
    print("Braces are balanced")
    return True

check_braces('script.js')
