pub mod auth {
    tonic::include_proto!("auth");
}
pub mod common {
    #![allow(unused)]
    tonic::include_proto!("common");
}
pub mod gateway {
    tonic::include_proto!("gateway");
}
pub mod notification {
    tonic::include_proto!("notification");
}
pub mod project {
    tonic::include_proto!("project");
}
pub mod subject {
    tonic::include_proto!("subject");
}
