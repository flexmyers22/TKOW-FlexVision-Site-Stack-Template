#include <cstdint>

using RobotStatus = std::uint16_t;

enum RobotStatusFlag : RobotStatus {
    KERNEL_ACTIVE    = 1u << 0,
    GPU_READY        = 1u << 1,
    WATCHDOG_OK      = 1u << 2,
    CRC_VALID        = 1u << 3,
    COMMAND_RECEIVED = 1u << 4,
    LOW_BATTERY      = 1u << 5,
    INTERLOCK_OPEN   = 1u << 6,
    LIMIT_ACTIVE     = 1u << 7,
    FAULT_ACTIVE     = 1u << 8,
    ESTOP_ACTIVE     = 1u << 9,
    TARGET_REACHED   = 1u << 10,
    MOTION_ACTIVE    = 1u << 11,
    HOMED            = 1u << 12,
    ARMED            = 1u << 13,
    SYSTEM_ONLINE    = 1u << 14
};

constexpr RobotStatus STATUS_MASK = 0x7FFFu;
constexpr RobotStatus UNUSED_BIT  = 0x8000u;

void setFlag(RobotStatus& status, RobotStatusFlag flag) {
    status |= flag;
}

void clearFlag(RobotStatus& status, RobotStatusFlag flag) {
    status &= static_cast<RobotStatus>(~flag);
}

bool hasFlag(RobotStatus status, RobotStatusFlag flag) {
    return (status & flag) != 0;
}

bool valid15BitWord(RobotStatus status) {
    return (status & UNUSED_BIT) == 0;
}