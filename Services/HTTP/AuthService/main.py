from service_lib import Service
from routes import *

print("Стартую!")
service = Service.get_service("Auth")
service.run()
