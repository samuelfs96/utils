import React, { useState } from 'react';
import Dialog from '@material-ui/core/Dialog';
import { CPXButton } from '@simplycodeless/uix.cpx-common';

const MoveGroupModal = ({ file, groups, onClose, handleAccept }: any) => {
  const [newGroup, setNewGroup] = useState(null);

  return (
    <Dialog open maxWidth={false} onClose={onClose}>
      <div className="CPXDoku-Modal-MoveGroup">
        <div className="CPXDoku-Modal-MoveGroup-Header">Selecciona el grupo</div>

        <div className="CPXDoku-Modal-MoveGroup-ListGroups">
          {groups.map(({ DokuGroupRef, IDDokuGroup }: any) => (
            <div
              key={IDDokuGroup}
              className={`CPXDoku-Modal-MoveGroup-ListGroups-Group${
                newGroup === IDDokuGroup ? ' selected' : ''
              }${file.IDDokuGroup === IDDokuGroup ? ' alreadyselected' : ''}`}
              onClick={() => {
                if (newGroup === IDDokuGroup) {
                  setNewGroup(null);
                } else if (file.IDDokuGroup !== IDDokuGroup) {
                  setNewGroup(IDDokuGroup);
                }
              }}
            >
              {DokuGroupRef}
            </div>
          ))}
        </div>

        <div className="CPXDoku-Modal-MoveGroup-Actions">
          <CPXButton color="default" variant="outlined" onClick={onClose}>
            Cancelar
          </CPXButton>
          <CPXButton
            autoFocus
            color="primary"
            disabled={!newGroup}
            variant="contained"
            onClick={() => handleAccept(newGroup)}
          >
            Mover
          </CPXButton>
        </div>
      </div>
    </Dialog>
  );
};

export default MoveGroupModal;
