// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MaintenanceLog {
    
    struct PredictionRecord {
        string machineId;
        uint256 riskPercent;
        string status;
        string action;
        uint256 timestamp;
        address recordedBy;
    }
    
    PredictionRecord[] public records;
    
    event MaintenanceAlert(
        string machineId,
        uint256 riskPercent,
        string status,
        uint256 timestamp
    );
    
    function logPrediction(
        string memory _machineId,
        uint256 _riskPercent,
        string memory _status,
        string memory _action
    ) public {
        PredictionRecord memory newRecord = PredictionRecord({
            machineId: _machineId,
            riskPercent: _riskPercent,
            status: _status,
            action: _action,
            timestamp: block.timestamp,
            recordedBy: msg.sender
        });
        
        records.push(newRecord);
        emit MaintenanceAlert(_machineId, _riskPercent, _status, block.timestamp);
    }
    
    function getRecord(uint256 index) public view returns (
        string memory, uint256, string memory, string memory, uint256, address
    ) {
        PredictionRecord memory r = records[index];
        return (r.machineId, r.riskPercent, r.status, r.action, r.timestamp, r.recordedBy);
    }
    
    function getTotalRecords() public view returns (uint256) {
        return records.length;
    }
}