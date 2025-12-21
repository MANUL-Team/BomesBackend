import secrets
import string

def generate_key(size):
    characters = string.ascii_letters + string.digits + string.punctuation
    secure_random_string = ''.join(secrets.choice(characters) for i in range(size))
    return secure_random_string
