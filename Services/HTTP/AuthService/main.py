from ServiceLib import Service
from routes import *

service = Service.get_service("Auth")
service.run()
