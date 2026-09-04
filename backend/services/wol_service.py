import socket


from utils.logger import log_info, log_warning, log_debug
def wake_on_lan(mac_address: str, broadcast_ip: str = "255.255.255.255", port: int = 9) -> bool:
    """
    发送Wake-on-LAN魔术包来远程开机

    Args:
        mac_address: 目标电脑的MAC地址，格式如 "AA:BB:CC:DD:EE:F" 或 "AA-BB-CC-DD-EE-FF"
        broadcast_ip: 广播地址，默认为 255.255.255.255
        port: UDP端口，默认为 9

    Returns:
        bool: 是否成功发送魔术包
    """
    try:
        # 将MAC地址转换为bytes
        mac_address = mac_address.replace("-", ":").replace(":", "")
        if len(mac_address) != 12:
            raise ValueError(f"Invalid MAC address format: {mac_address}")

        # 解析MAC地址
        mac_bytes = bytes.fromhex(mac_address)

        # 构建魔术包：6字节的 0xFF + 16次 MAC地址
        magic_packet = rb"\xff" * 6 + mac_bytes * 16

        # 创建UDP socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

        # 发送魔术包
        sock.sendto(magic_packet, (broadcast_ip, port))
        sock.close()

        log_info(f"[WOL] Magic packet sent to {mac_address}")
        return True

    except Exception as e:
        log_warning(f"[WOL] Error sending magic packet: {e}", exception=e)
        return False


def wake_multiple(
    mac_addresses: list, broadcast_ip: str = "255.255.255.255", port: int = 9
) -> dict:
    """
    批量唤醒多台电脑

    Args:
        mac_addresses: MAC地址列表
        broadcast_ip: 广播地址
        port: UDP端口

    Returns:
        dict: 每台电脑的唤醒结果
    """
    results = {}
    for mac in mac_addresses:
        results[mac] = wake_on_lan(mac, broadcast_ip, port)
    return results


def is_valid_mac(mac_address: str) -> bool:
    """验证MAC地址格式"""
    mac_clean = mac_address.replace("-", ":").replace(":", "")
    if len(mac_clean) != 12:
        return False
    try:
        bytes.fromhex(mac_clean)
        return True
    except ValueError:
        return False
