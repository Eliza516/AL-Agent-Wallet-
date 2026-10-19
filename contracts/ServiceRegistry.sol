// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ServiceRegistry - danh bạ dịch vụ trả tiền theo lần gọi (interface v1)
contract ServiceRegistry {
    struct Service { string name; uint256 price; address payTo; address provider; bool active; }

    Service[] private services;

    event ServiceRegistered(uint256 indexed id, string name, uint256 price, address payTo, address indexed provider);
    event ServiceUpdated(uint256 indexed id, uint256 price, bool active);

    error NotProvider();
    error UnknownService(uint256 id);

    function register(string calldata name, uint256 price, address payTo) external returns (uint256 id) {
        id = services.length;
        services.push(Service(name, price, payTo, msg.sender, true));
        emit ServiceRegistered(id, name, price, payTo, msg.sender);
    }

    function update(uint256 id, uint256 price, bool active) external {
        if (id >= services.length) revert UnknownService(id);
        if (services[id].provider != msg.sender) revert NotProvider();
        services[id].price = price;
        services[id].active = active;
        emit ServiceUpdated(id, price, active);
    }

    function serviceCount() external view returns (uint256) { return services.length; }

    function getService(uint256 id) external view returns (string memory name, uint256 price, address payTo, address provider, bool active) {
        if (id >= services.length) revert UnknownService(id);
        Service storage s = services[id];
        return (s.name, s.price, s.payTo, s.provider, s.active);
    }
}
