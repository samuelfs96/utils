/* global CPXMetodos */
import CircularProgress from '@material-ui/core/CircularProgress';
import React, { createRef, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { getDokuViewStore } from './state';
import { RequestHandler, OldServices as Service } from '@simplycodeless/core.cpx-tools';
import { copyValue, getStorage, isTempXInsideOrNone } from '@simplycodeless/core.cpx-utils';
import { GenericIcon, HeaderStandard } from '@simplycodeless/uix.cpx-common';

const isMobile = false;
const AvatarSubGroups = ['APPDKGAVSIMZ', 'APPDKGAVSIMX'];

const DokuTempsItemsForProp = {
  modern: 'CPXDoku-Modern',
  standard: 'CPXDoku-Standard',
};
const DokuTempsItemsForTab = {
  docs: 'CPXDoku-W-Avatar',
  media: 'CPXDoku-W-Thumb',
};

const CPXDokuV2 = (props: any) => {
  const { formItem: formItemProps } = props;
  const formItem = formItemProps ? copyValue(formItemProps) : { rowSession: {} };

  formItem.rowSession.SRCIDObjCode =
    formItem.rowSession.SRCIDObjCode || formItem.rowSession.IDObjCode;
  formItem.rowSession.IDObjCode = formItem.rowSession.SRCIDObjCode;

  formItem.rowSession.SRCIDBaseField =
    formItem.rowSession.SRCIDBaseField ||
    formItem.rowSession.IDObjID ||
    formItem.rowSession.IDBaseField;
  formItem.rowSession.IDObjID = formItem.rowSession.SRCIDBaseField;
  formItem.rowSession.IDBaseField = formItem.rowSession.SRCIDBaseField;
  const store = useMemo(
    () =>
      getDokuViewStore({
        fileID: null,
        filterItems: '',
        template: 'standard',
        selectedTab: 'media',
        selectedFiles: [],
        selectedGroup: null,
        isLoadingGroups: true,
        enableCompress: true,
        formatConvert: false,
        isCmdPressed: false,
        avatarUpdateNumber: 0,
        uploadUrl: { value: '', error: '' },
        files: [],
        copyFiles: null,
        groups: [],
        formItem,
        DKConfig: {},
        AIConfig: {},
        supported: [],
        listUploadFiles: [],
        MDRInfoValSelected: null,
        tempInfoDoku: null,
        isLoadingTempInfoDoku: true,
        tempInfoFormKeys: null,
        isLoadingTempInfoFormKeys: true,
        ModalDoku: null,
        PopperUseAs: null,
        ModalEditFile: false,
        ModalMoveGroup: false,
        ModalConfirmDelete: false,
        ModalConfirmAIDelete: false,
        hasError: false,
        messageError: null,
        user: getStorage('infoUser'),
        service: new Service(),
        dropzone: createRef(),
        showClose: !props.hideClose && !isMobile,
        // @ts-expect-error CPXMetodos-global-const
        tempInfo: CPXMetodos.getByNameTemplate('FORMStandalone-Template'),
        docGroups: [
          'DKCDOC',
          'DKCPDF',
          'DKCPPT',
          'DKCRAR',
          'DKCTXT',
          'DKCXLS',
          'DKCZIP',
          'DKCJS',
          'DKCCSS',
        ],
        groupsInfo: [],
        mediaGroups: ['DKCJPG', 'DKCMP3', 'DKCXYTB', 'DKCPNG', 'DKCPEG', 'DKCSVG', 'DKCWEP'],
        hiddenSubGroups: [...AvatarSubGroups],
        protectedGroups: ['APPRAVEN'],
        protectedSubGroups: [],
        ComJumps: 12,
        NumPagView: 1,
        MaxItemsInPage: 50,
        thereSomeChange: false,
        currR: new RequestHandler(),
        designDefID: 'CFD637304245935055835',
        designID: null,
        props,
        IS_SSEARCH: false,
        AvatarSubGroups,
        myDropzone: null,
        scrollContent: createRef(),
        DokuTempsItemsForProp,
        DokuTempsItemsForTab,
        isMobile,
      }),
    [props]
  );
  const state = useStore(store);
  const {
    DoFetches,
    keyDown,
    keyUp,
    handleCancelAllFeths,
    selectedTab,
    selectedTabAction,
    clearPagValues,
    handleClose,
    DKConfig,
    tempInfoDoku,
    hasError,
    isLoadingTempInfoDoku,
    showClose,
    isLoadingGroups,
    messageError,
    renderDokuWTemplate,
  } = state;

  useEffect(() => {
    DoFetches();
    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);

    return () => {
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('keyup', keyUp);
      handleCancelAllFeths();
    };
  }, []);

  useEffect(() => {
    clearPagValues();
    if (selectedTab === 'docs') {
      selectedTabAction(selectedTab);
    } else if (selectedTab === 'media') {
      selectedTabAction(selectedTab);
    }
  }, [selectedTab]);

  if (DKConfig && tempInfoDoku && !hasError && !isLoadingTempInfoDoku) {
    return renderDokuWTemplate();
  } else {
    const isXOutSide = !isTempXInsideOrNone(props.formItem.CPXModalConfig?.XPosition);

    return (
      <div className="CPXApp-Common-Centered-Element">
        <HeaderStandard
          expandedMode
          hideButtonBack
          hideReload
          hideSearch
          SubTitle=""
          Title=""
          extraButtons={[
            {
              icon: 'mdi mdi-close',
              tooltip: 'Close',
              onClick: handleClose,
              isVisible: showClose && !isXOutSide,
            },
          ]}
          styleHeader={{ background: 'transparent' }}
        />
        <div style={{ width: '100%', height: 'calc(100% - 100px)' }}>
          <div className="CPXApp-Common-Centered-Element">
            {isLoadingGroups && !hasError && <CircularProgress color="secondary" />}

            {hasError && (
              <>
                <GenericIcon icon="md/MdError" style={{ fontSize: '5rem' }} />
                <span style={{ fontSize: '18px', fontWeight: '400' }}>
                  {messageError || 'Ocurrió un error'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default CPXDokuV2;
