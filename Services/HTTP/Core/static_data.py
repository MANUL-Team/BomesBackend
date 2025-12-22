import os
from dotenv import load_dotenv

load_dotenv()

RABBIT_ADDRESS = os.getenv("RABBIT_ADDRESS")
RABBIT_USERNAME = os.getenv("RABBIT_USERNAME", "guest")
RABBIT_PASSWORD = os.getenv("RABBIT_PASSWORD", "guest")
CORE_INDEX = os.getenv("CORE_INDEX", 0)

connection = None
channel = None
returned_messages = {}
