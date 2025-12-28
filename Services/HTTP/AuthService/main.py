from service_lib import Service
from routes import *

service = Service.get_service("Auth")
service.run()
