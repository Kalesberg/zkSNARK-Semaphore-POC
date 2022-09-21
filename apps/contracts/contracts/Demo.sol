//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@semaphore-protocol/contracts/interfaces/IVerifier.sol";
import "@semaphore-protocol/contracts/base/SemaphoreCore.sol";
import "@semaphore-protocol/contracts/base/SemaphoreGroups.sol";

contract Demo is SemaphoreCore, SemaphoreGroups {
    event SignalAdded(uint256 indexed groupId, bytes32 signal);
    event GroupAdded(uint256 indexed groupId, bytes32 groupName);

    uint8 public treeDepth;
    IVerifier public verifier;

    constructor(uint8 _treeDepth, IVerifier _verifier) {
        treeDepth = _treeDepth;
        verifier = _verifier;
    }

    function createGroup(bytes32 groupName) public {
        uint256 groupId = hashGroupName(groupName);

        _createGroup(groupId, treeDepth, 0);

        emit GroupAdded(groupId, groupName);
    }

    function addMember(uint256 groupId, uint256 identityCommitment) public {
        _addMember(groupId, identityCommitment);
    }

    function removeMember(
      uint256 groupId,
      uint256 identityCommitment,
      uint256[] calldata proofSiblings,
      uint8[] calldata proofPathIndices
    ) public {
      _removeMember(groupId, identityCommitment, proofSiblings, proofPathIndices);
    }

    function addSignal(
        bytes32 signal,
        uint256 nullifierHash,
        uint256 groupId,
        uint256[8] calldata proof
    ) public {
        uint256 root = groups[groupId].root;

        _verifyProof(signal, root, nullifierHash, groupId, proof, verifier);

        // _saveNullifierHash(nullifierHash);

        emit SignalAdded(groupId, signal);
    }

    function hashGroupName(bytes32 groupName) private pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(groupName))) >> 8;
    }
}
