fn main() -> Result<(), Box<dyn std::error::Error>> {
    let proto_path = std::env::var("PROTO_PATH").unwrap_or_else(|_| "../../proto".to_string());
    let protoc = protoc_bin_vendored::protoc_bin_path()?;
    let protoc_include = protoc_bin_vendored::include_path()?;

    unsafe {
        std::env::set_var("PROTOC", protoc);
        std::env::set_var("PROTOC_INCLUDE", &protoc_include);
    }

    tonic_prost_build::configure().compile_protos(
        &[
            format!("{proto_path}/auth.proto"),
            format!("{proto_path}/eval.proto"),
            format!("{proto_path}/common.proto"),
            format!("{proto_path}/notification.proto"),
            format!("{proto_path}/project.proto"),
            format!("{proto_path}/subject.proto"),
        ],
        &[proto_path, protoc_include.to_str().unwrap().to_string()],
    )?;

    Ok(())
}
