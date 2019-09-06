pragma solidity ^0.4.25;


contract Notary {
    mapping (bytes32 => uint256) public _data;

    event DidAddTimestamp (bytes32 indexed hash, uint256 indexed timestamp);

    function addTimestamp (bytes32 hash, uint256 timestamp) {
        _data[hash] = timestamp;
        emit DidAddTimestamp(hash, timestamp);
    }
}
