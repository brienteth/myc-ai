use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;
use log::info;

pub struct Discovery {
    daemon: ServiceDaemon,
}

impl Discovery {
    pub fn new() -> Self {
        let daemon = ServiceDaemon::new().expect("Failed to create mDNS daemon");
        Discovery { daemon }
    }

    pub fn advertise(&self, device_id: &str, port: u16) {
        let service_type = "_myca._udp.local.";
        let instance_name = device_id;
        let host_name = format!("{}.local.", device_id);
        
        let properties: HashMap<String, String> = HashMap::new();
        
        let my_service = ServiceInfo::new(
            service_type,
            instance_name,
            &host_name,
            "",
            port,
            properties,
        ).expect("valid service info");

        self.daemon.register(my_service).expect("Failed to register mDNS service");
        info!("Started mDNS advertisement for device {}", device_id);
    }
}
