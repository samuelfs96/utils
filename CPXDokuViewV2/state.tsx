/* global CPXMetodos */
import groupBy from 'lodash.groupby';
import Dropzone from 'dropzone';
import axios from 'axios';
import { createStore } from 'zustand';

import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import Fab from '@material-ui/core/Fab';
import Fade from '@material-ui/core/Fade';
import CircularProgress from '@material-ui/core/CircularProgress';
import React, { createRef } from 'react';
import { getImgElement, getImgPosition, parseDate, parseNumber } from '../tools';

import FileViewer from '../Dialogs/FileViewer';

import {
  PreviewImageCard,
  ToolsFilesButtons,
  ToolsFilesText,
  WDoku,
  WrapperAvatarUpload,
  WrapperFilesOptions,
  WrapperTabs,
} from '../styles';
import EditFile from '../Dialogs/EditFile';
import UseAsPopper from '../Dialogs/UseAsPopper';
import type { DokuViewProps, DokuViewState } from './types';
import MoveGroupModal from './MoveGroupModal';
import { AppConstants } from '@simplycodeless/core.cpx-constants';
import {
  GetParameterFromQuerystring,
  ItemClick,
  MainLoaderIndicator,
  RandomStr,
  copyValue,
  dokuInfo,
  formatBytes,
  getAbsoluteOrAddPrefixToUrl,
  getFileExt,
  getStorage,
  isImageDoku,
  noDiacritical,
  parseAndReturnObj,
  parseLowerCase,
  replaceAt,
  validFileName,
} from '@simplycodeless/core.cpx-utils';
import { FormActions } from '@simplycodeless/core.cpx-actions';
import { ApiPostAsync, ApiPostCompressAsync, getTemplate } from '@simplycodeless/core.cpx-tools';

import { CPXCheckBox, CPXTextField } from '@simplycodeless/uix.cpx-form-controls';

import {
  Avatar,
  BarNav,
  CPXDevButtons,
  CPXPagination,
  CPXSimpleTooltip,
  ConfirmModal,
  DTempActionLinks,
  DTempAvatar,
  DTempBackground,
  DTempCloseAction,
  DTempContent,
  DTempFABLinks,
  DTempHeader,
  DTempPin,
  DTempSmartSearch,
  GenericIcon,
  HeaderStandard,
  IconButton,
  ScrollContainer,
} from '@simplycodeless/uix.cpx-common';
import { CPXAvatarUpload } from '@simplycodeless/ctrls.cpx-uploads';

const DEFAULT_PROPS: DokuViewProps = {
  fileID: null,
  filterItems: '',
  template: '',
  selectedTab: '',
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
  formItem: null,
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
  user: null,
  service: null,
  dropzone: createRef(),
  showClose: false,
  tempInfo: null,
  docGroups: [],
  groupsInfo: [],
  mediaGroups: [],
  hiddenSubGroups: [],
  protectedGroups: [],
  protectedSubGroups: [],
  ComJumps: 0,
  NumPagView: 0,
  MaxItemsInPage: 0,
  thereSomeChange: false,
  currR: null,
  designDefID: '',
  designID: null,
  props: null,
  IS_SSEARCH: false,
  AvatarSubGroups: [],
  myDropzone: null,
  scrollContent: createRef(),
  DokuTempsItemsForProp: [],
  DokuTempsItemsForTab: [],
  isMobile: false,
};

export const getDokuViewStore = (initValues: Partial<DokuViewProps>) => {
  return createStore<DokuViewState>()((setState, get) => ({
    ...DEFAULT_PROPS,
    ...initValues,
    setState,
    DoFetches: async (isRefresh = false) => {
      const state = get();
      const {
        formItem,
        props,
        currR,
        showClose,
        designDefID,
        MaxItemsInPage,
        service,
        user,
        groupsInfo,
        protectedGroups,
        protectedSubGroups,
      } = state;
      const { isAnalizer } = props;

      const { id: keySource, source } = currR.add();

      let DKConfig: any = formItem.ConfigData ? copyValue(formItem.ConfigData) : null;

      if (!DKConfig || isRefresh) {
        // Cargamos la configuracion del Doku
        DKConfig = await get().getFetchQuery(null, 'Q0001637227349890280348', {
          source,
        });
      }

      if (!DKConfig) {
        setState({
          isLoadingGroups: false,
          hasError: true,
          messageError: 'No se pudo cargar la configuración del Doku',
        });
      } else if (showClose && formItem.id) {
        window.EventBus.invokeOnStore('modifyForm', formItem.id, { ConfigData: DKConfig });
      }

      DKConfig.DokuViewTitle = replaceAt(
        formItem.rowSession,
        undefined,
        DKConfig.DokuViewTitle || 'Doku'
      );

      const idTemp = DKConfig.DokuViewTemplate || designDefID;
      setState({
        ComJumps:
          DKConfig.DokuViewMaxFile && DKConfig.DokuViewMaxFile <= MaxItemsInPage
            ? DKConfig.DokuViewMaxFile
            : 10,
        designID: idTemp,
        IS_SSEARCH: true,
      });

      let tempInfoDoku = !isRefresh ? formItem.tempData : null;

      const responseTemp = await getTemplate(tempInfoDoku, 'Doku', idTemp);

      if (responseTemp.error) {
        console.log('Ocurrio un error al cargar el template del Doku', responseTemp.error);
        setState({
          messageError: 'No se pudo cargar el template del doku',
          hasError: true,
        });
      } else {
        tempInfoDoku = responseTemp.tempInfo;
        tempInfoDoku.FrmDDoku = parseAndReturnObj(tempInfoDoku.FrmDDoku);
        setState({ designID: responseTemp.designID });

        if (isRefresh && showClose && formItem.id) {
          window.EventBus.invokeOnStore('modifyForm', formItem.id, { tempData: tempInfoDoku });
        }
      }

      setState({
        DKConfig,
        tempInfoDoku,
        isLoadingTempInfoDoku: false,
      });

      const rowToService = {
        entidad: JSON.stringify({
          SRCIDObjCode: formItem.rowSession.IDObjCode,
          SRCIDBaseField: formItem.rowSession.SRCIDBaseField,
        }),
        DokuTipos: JSON.stringify(getStorage('DOKU-Tipos') || []),
        IDCpanaxID: user.IDCpanaxID,
      };

      service
        .externalpost('@VultureNew querygrupos', rowToService, {
          cancelToken: source.token,
        })
        .then(async ({ data }: any) => {
          const groups = data.DokuGroups;
          const supported = data.DokuSupported;

          let files = data.DokuFiles;
          let DModeler = {}; // D - Data
          let AIConfig: any = {};
          let tempInfoFormKeys = null;

          if (isAnalizer) {
            // Cargamos la data del modelo
            if (formItem.rowSession.SRCIDBaseField) {
              DModeler = await get().getFetchQuery(null, 'Q0001637194693316835126', { source });
            }

            // Cargamos la config del analyser
            AIConfig = await get().getFetchQuery(null, 'Q0001637203274851950146', { source });

            // Cargamos la data del template avanzado
            if (AIConfig.IDFrmDesing_Analyzer) {
              const responseTempKeys = await getTemplate(
                null,
                'Doku',
                AIConfig.IDFrmDesing_Analyzer
              );

              if (responseTempKeys.error) tempInfoFormKeys = null;
              else tempInfoFormKeys = responseTempKeys.tempInfo;
            }

            // Filtra para mostrar solo imagenes
            files = files.filter(({ IDDokuClase }: any) => isImageDoku(IDDokuClase));

            // Establecemos los valores por defecto de propiedades
            files = files.map((file: any) => ({
              ...file,
              ...get().getAIInitialFileConfig(),
              modeler: DModeler || {},
            }));
          }

          groups.forEach((group: any) => {
            const alreadyExist = groupsInfo.some(
              ({ IDDokuGroup }: any) => group.IDDokuGroup === IDDokuGroup
            );
            if (
              !alreadyExist &&
              !protectedGroups.includes(group.IDDokuGroup) &&
              !protectedSubGroups.includes(group.IDDokuSubGroup)
            ) {
              groupsInfo.push({
                IDDokuGroup: group.IDDokuGroup,
                DokuGroupRef: group.DokuGroupRef,
                CHKCDNViewObject: group.CHKCDNViewObject,
              });
            }
          });

          supported.forEach((sup: any) => {
            if (!sup.DokuTipoExt) {
              return (sup.DokuTipoExt = []);
            }

            sup.DokuTipoExt = sup.DokuTipoExt.split(',');
            sup.DokuTipoExt = sup.DokuTipoExt.map((ext: any) => ext.toLowerCase());
          });

          currR.remove(keySource);

          setState({
            files,
            groups,
            AIConfig,
            supported,
            tempInfoFormKeys,
            isLoadingGroups: false,
            isLoadingTempInfoFormKeys: false,
          });
          get().initDropZone();
        })
        .catch((error: any) => {
          if (error.message === currR.cancellationMessage) return;

          console.log('CPXDoku Ocurrio un error al obtener los datos del Doku', error.message);
          window.EventBus.invokeOnAlertStore(
            'showNotification',
            'No se pudo cargar el Doku',
            'CPXDoku',
            'error'
          );
          setState({
            isLoadingGroups: false,
            hasError: true,
            messageError: error.message,
          });
        });
    },

    getFetchQuery: async (row, IDQ, config = { array: false, source: null, sourceName: null }) => {
      const state = get();
      const { formItem, currR } = state;

      let IDTransaction = null;

      if (!config.source) {
        IDTransaction = config.sourceName || `STDFetchQuery${RandomStr(5)}`;

        config.source = axios.CancelToken.source();

        currR.add(config.source, IDTransaction);
      }

      let resultData = await ApiPostCompressAsync(
        `${AppConstants().URLProcesos}PostDatos`,
        {
          IDQ,
          row: !row ? formItem.rowSession : row,
        },
        false,
        config.source
      );

      if (IDTransaction) {
        currR.remove(IDTransaction);
      }

      if (resultData.Result) {
        resultData = JSON.parse(resultData.Result);

        if (!config.array) {
          if (resultData && resultData.length) {
            resultData = resultData[0];
          } else {
            resultData = {};
          }
        } else if (config.array && (!resultData || !Array.isArray(resultData))) {
          resultData = [];
        }
      } else {
        resultData = !config.array ? {} : [];
      }

      return resultData;
    },

    fetchSSearch: async (text) => {
      const keySource = 'SSearchFetch';
      const state = get();
      const { currR, user, AvatarSubGroups } = state;

      if ((!state.isLoadingGroups || currR.exist(keySource)) && text.length === 0) {
        if (state.isLoadingGroups) {
          currR.cancel(keySource);
        }

        setState((prevState) => ({
          files: prevState.copyFiles || prevState.files,
          copyFiles: null,
          isLoadingGroups: false,
        }));

        return;
      }

      if (state.isLoadingGroups) return;

      get().clearPagValues();

      const { source } = currR.add(null, keySource);

      const timerToShowLoader = setTimeout(() => {
        if (currR.exist(keySource)) {
          setState({ isLoadingGroups: true });
        }

        clearTimeout(timerToShowLoader);
      }, 500);

      const { formItem } = state;

      const ESIndex =
        `${user.IDCpanaxID}${formItem.rowSession.SRCIDObjCode}${formItem.rowSession.SRCIDBaseField}`.toLowerCase();

      const responseID = await ApiPostAsync(
        '@Heron smartsearch',
        { index: ESIndex, search: text },
        source
      );

      currR.remove(keySource);

      if (responseID.error) {
        if (responseID.error === currR.cancellationMessage) return;

        setState({
          isLoadingGroups: false,
          hasError: true,
          messageError: responseID.error,
          // hasError: [['Ocurrio un error al hacer el smart search', responseID.error]],
        });
      }

      const finalResultsID = ((responseID.result as any)?.hits?.hits || []).map(
        ({ _id }: any) => _id
      );

      setState((prevState) => ({
        files: (prevState.copyFiles || prevState.files).filter(
          ({ IDDoku, IDDokuSubGroup }: any) =>
            finalResultsID.includes(IDDoku) || AvatarSubGroups.includes(IDDokuSubGroup)
        ),
        copyFiles: !prevState.copyFiles ? copyValue(prevState.files) : prevState.copyFiles,
        isLoadingGroups: false,
      }));
    },

    initDropZone: () => {
      const state = get();
      const {
        formItem,
        DKConfig,
        dropzone,
        user,
        isValidFileExt,
        getSubGroupFromFile,
        updateFileUpload,
        getFormattedFileFromServer,
        getAIInitialFileConfig,
        handleDeleleListUploadFile,
        handleClosePanel,
      } = state;

      try {
        if (!dropzone.current) {
          console.log(
            'No se puede inicializar el dropzone debido a que this.dropzone no tiene un referencia valida'
          );
          return;
        }

        Dropzone.autoDiscover = false;

        const myDropzone = new Dropzone(dropzone.current, {
          url: `${AppConstants().Vulture}upload`,
          accept: (file: any, done) => {
            file.extention = getFileExt(file.name);

            const validExt = isValidFileExt(file.name);
            const validName = validFileName(file.name);
            const validInGroup = getSubGroupFromFile(file.name);

            if (validExt && validName && validInGroup) {
              done();
            } else {
              file.error = true;
              file.errorMessage = '';

              if (!validExt) {
                file.errorMessage = 'Tipo de archivo no admitido.';
              } else if (!validName) {
                file.errorMessage = 'Nombre de arhivo no permitido.';
              } else if (!validInGroup) {
                file.errorMessage = 'Tipo de archivo no admitido en el grupo.';
              }

              updateFileUpload(file.id, {
                error: true,
                messageError: file.errorMessage,
              });
            }
          },
          timeout: 1000 * 60 * 6,
          maxFilesize: 30,
          parallelUploads: 1,
          createImageThumbnails: false,
          autoProcessQueue: true,
        });

        myDropzone.on('success', (file: any, responseStr) => {
          // TODO - El servicio deberia de devolver los datos completos del archivo, para agregarlo directamente al Doku Client
          // console.log("success fired: ", { responseStr }); // file,
          const state = get();

          setState({ thereSomeChange: true });

          const response: any = parseAndReturnObj(responseStr);

          if (response.error) {
            console.log('error fired: ', { file, error: response.error });
            updateFileUpload(file.id, {
              error: true,
              errorMessage: response.error === 'Duplicate' ? 'Archivo Duplicado' : response.error,
              uploading: false,
              processing: false,
              sended: false,
            });
            return;
          }

          const FileUploaded = responseStr ? response.result : {};
          const FileToAdd = {
            ...getFormattedFileFromServer(FileUploaded, {
              IDDokuGroup: state.selectedGroup.IDDokuGroup,
            }),
            ...getAIInitialFileConfig(),
          };

          // console.log({ FileToAdd });

          const timeToRemove = setTimeout(() => {
            handleDeleleListUploadFile(file, () => {
              if (state.listUploadFiles.length === 0) {
                handleClosePanel();
              }
            });
            clearTimeout(timeToRemove);
          }, 1000);

          updateFileUpload(
            file.id,
            {
              processing: false,
              sended: true,
              compressed: FileToAdd.Doku_Optimizer === 1,
            },
            () => {
              // const allSended = this.state.listUploadFiles.every(({ sended }) => sended);
              // const someUploading = this.isUploadingFile();

              // if (allSended && !someUploading) {
              // console.log("Todo los elementos fueron enviados, recargando Doku");
              // this.handleClickReload();
              setState((prevState) => ({ files: [...prevState.files, FileToAdd] }));
              // }
            }
          );
        });
        myDropzone.on('drop', () => {
          // console.log("drop fired");
        });
        myDropzone.on('addedfile', (file: any) => {
          file.id = RandomStr(3);
          file.IDDokuSubGroup = getSubGroupFromFile(file.name);
          // file.url = URL.createObjectURL(file);

          // console.log("addedfile fired: ", { file });
          const state = get();
          const { listUploadFiles, selectedGroup } = state;

          listUploadFiles.unshift(file);

          const ESIndex =
            `${user.IDCpanaxID}${formItem.rowSession.SRCIDObjCode}${formItem.rowSession.SRCIDBaseField}`.toLowerCase();

          myDropzone.options.headers = {
            DokuInfoHeader: JSON.stringify({
              oid: formItem.rowSession.SRCIDBaseField,
              index: ESIndex,
              ocode: formItem.rowSession.IDObjCode,
              Source: '',
              Storage: 'S3',
              LoginUser: user.IDLoginUser,
              idloginuser: user.IDLoginUser,
              IDAPIDataCloudProvider: DKConfig.IDAPIDataCloudConexion,
              idcpanaxid: user.IDCpanaxID,
              IDDokuGroup: selectedGroup.IDDokuGroup,
              // IDDokuSubGroup: this.getSubGroupFromFile(file.name), Se setea directamente en el archivo en el evento de "sending", asi se pueden subir varios archivos de diferentes subgrupos y porderlos clasificar correctamente
            }),
          };

          setState({ listUploadFiles });
        });
        myDropzone.on('dragenter', (_file) => {
          // console.log("dragenter fired: ", { file });
        });
        myDropzone.on('uploadprogress', (file: any, progress) => {
          // console.log("uploadprogress fired: ", { file, progress });

          const obj = {
            progress,
            uploading: progress < 100,
            processing: progress === 100,
          };

          updateFileUpload(file.id, obj);
        });
        myDropzone.on('error', (file: any, errorMessage: any, xhr: any) => {
          console.log('error fired: ', { file, errorMessage, xhr });
          updateFileUpload(file.id, {
            error: true,
            errorMessage:
              typeof errorMessage === 'string'
                ? errorMessage
                : 'Ocurrió un error al subir el archivo.',
            uploading: false,
            processing: false,
            sended: false,
          });
        });
        myDropzone.on('complete', (_file) => {
          // console.log("complete fired: ", { file });
        });
        myDropzone.on('completemultiple', () => {
          // console.log("completemultiple");
        });
        myDropzone.on('canceled', (_file) => {
          // console.log('canceled fired: ', { file });
        });
        myDropzone.on('thumbnail', (_file, _dataUrl) => {
          // console.log('thumbnail fired: ', { file, dataUrl, });
        });
        myDropzone.on('sending', (file: any, _xhr, formData) => {
          // console.log("Fired sending: ", file);

          if (state.formatConvert) {
            formData.append('formatconvert', 'webp');
            // @ts-expect-error component-in-js
            formData.append('towebp', true);
          }

          formData.append('IDDokuSubGroup', file.IDDokuSubGroup);
          // @ts-expect-error component-in-js
          formData.append('compress', state.enableCompress);
          updateFileUpload(file.id, {
            shouldCompress: state.enableCompress,
          });
        });
        setState({ myDropzone });
      } catch (err: any) {
        setState({ hasError: true, messageError: err.message });
      }
    },

    handleBulkES: async () => {
      const state = get();
      const { currR, user } = state;
      const { id: keySource, source } = currR.add();

      MainLoaderIndicator(true);

      const { formItem } = state;

      const ESIndex =
        `${user.IDCpanaxID}${formItem.rowSession.SRCIDObjCode}${formItem.rowSession.SRCIDBaseField}`.toLowerCase();

      const response = await ApiPostAsync(
        '@Vulture esbulkinsert',
        {
          index: ESIndex,
          objid: formItem.rowSession.SRCIDBaseField,
        },
        source
      );

      currR.remove(keySource);

      MainLoaderIndicator(false);

      if (response.error) {
        if (response.error === currR.cancellationMessage) return;
        console.log('Ocurrió un error al hacer el Bulk de ElasticSearch: ', response.error);
        window.EventBus.invokeOnAlertStore(
          'showNotification',
          'Ocurrió un error al hacer el Bulk de ElasticSearch',
          'CPXDoku',
          'error'
        );
        return;
      }

      console.log(response.result);
      window.EventBus.invokeOnAlertStore('showNotification', 'Bulk realizado correctamente');
    },

    keyDown: (event) => {
      if (event.keyCode === 16) {
        setState({ isCmdPressed: true });
      }
    },

    keyUp: (event) => {
      const state = get();
      if (event.keyCode === 16 && state.isCmdPressed) {
        setState({ isCmdPressed: false });
      }
    },

    isValidFileExt: (fileName) => {
      const state = get();
      const { supported } = state;
      const colExtensions = supported.map(({ DokuTipoExt }) => DokuTipoExt);
      const rowExtensions: any[] = [];

      colExtensions.forEach((exts) => {
        exts.forEach((ext: any) => {
          if (ext && ext.trim()) rowExtensions.push(ext);
        });
      });

      const extension = getFileExt(fileName).replace('.', '');

      // console.log({ rowExtensions });

      return rowExtensions.includes(extension);
    },

    getSelectedFile: (fileID) => {
      const state = get();
      const { files } = state;

      if (!fileID) fileID = state.fileID;

      if (fileID) {
        const file = files.find(({ IDDoku }) => IDDoku === fileID);

        if (typeof file !== 'undefined') {
          return copyValue(file);
        } else {
          return false;
        }
      }
    },

    getSubGroupFromFile: (fileName, selectedGroup = null, extension = '') => {
      const state = get();
      if (!selectedGroup) selectedGroup = state.selectedGroup;
      if (!extension) extension = getFileExt(fileName).replace('.', '');

      const { groups, supported, AvatarSubGroups } = state;

      const matchSupported = supported.find(({ DokuTipoExt }) => DokuTipoExt.includes(extension));

      if (matchSupported) {
        const matchDokuTipo = matchSupported.IDDokuTipo;
        const group = groups.find(
          ({ IDDokuGroup, IDDokuTipo, IDDokuSubGroup }) =>
            IDDokuTipo === matchDokuTipo &&
            IDDokuGroup === selectedGroup.IDDokuGroup &&
            !AvatarSubGroups.includes(IDDokuSubGroup)
        );

        // console.log({ matchSupported, matchDokuTipo, group, });

        if (!group) {
          return '';
        } else {
          return group.IDDokuSubGroup;
        }
      } else {
        return '';
      }
    },

    getFormattedFileFromServer: (file, { IDDokuGroup }) => {
      return {
        IDDoku: file.IDDoku,
        IDObjID: file.ObjID,
        Doku_Ref: file.Filename,
        IDObjCode: file.ObjCode,
        Doku_UrlUbi: file.Path,
        Doku_Optimizer: file.DokuOptimizer,
        IDDokuClase: file.Ext,
        IDDokuGroup,
        Doku_FileSize: file.Len,
        Doku_UrlThumb: file.PublicUrl,
        IDDokuProvider: file.IddokuProvider,
        IDDokuSubGroup: file.IDGroupSub,
        Doku_DateUpload: new Date().toISOString(),
      };
    },

    openPanelUpload: () => {
      const state = get();
      const { selectedGroup, groupsInfo, props } = state;
      if (groupsInfo.length) {
        let groupToSet = selectedGroup || (groupsInfo.length === 1 ? groupsInfo[0] : null);

        const indexAnalizer = groupsInfo.findIndex(({ IDDokuGroup }) => IDDokuGroup === 'APPXAIX');

        if (props.isAnalizer && indexAnalizer !== -1) {
          groupToSet = groupsInfo[indexAnalizer];
        }

        if (groupToSet) {
          groupToSet.subGroupExternalUrl =
            state.groups.find(
              ({ IDDokuTipo, IDDokuGroup }) =>
                IDDokuTipo === 'DKTMED' && IDDokuGroup === groupToSet.IDDokuGroup
            )?.IDDokuSubGroup || null;
        }

        setState({ ModalDoku: 'PUpload', selectedGroup: groupToSet });
      } else {
        window.EventBus.invokeOnAlertStore('showNotification', '¡No existen grupos!');
      }
    },

    updateFileUpload: (fileID, obj, callback = () => {}) => {
      const state = get();
      const { listUploadFiles } = state;

      const fileToUpdate = listUploadFiles.find(({ id }) => id === fileID);

      if (typeof fileToUpdate !== 'undefined') {
        Object.assign(fileToUpdate, obj);
        setState({ listUploadFiles });
        callback();
      }
    },

    updateFileData: (
      fileID = get().fileID,
      dataUpdate = {},
      dataUpdateX = {},
      callback = () => {}
    ) => {
      const state = get();
      const { files } = state;
      const file = files.find(({ IDDoku }) => fileID === IDDoku);

      if (typeof file !== 'undefined') {
        Object.assign(file, dataUpdate);
      }

      setState({ files, ...dataUpdateX });
      callback();
    },

    isUploadingFile: () => {
      const state = get();
      const { listUploadFiles } = state;
      return listUploadFiles.some(({ uploading, processing }) => uploading || processing);
    },

    clearPagValues: () => {
      setState({ NumPagView: 1 });
    },

    updateDokuAvatars: async () => {
      const state = get();
      const { currR, props, AvatarSubGroups } = state;
      const { id: keySource, source } = currR.add();

      const response = await ApiPostCompressAsync(
        `@URLDeploy GetDataFromTableDynamo?id=${props.formItem.rowSession.SRCIDBaseField}`,
        {
          FieldsReturn: ['IDDoku', 'Doku_UrlUbi', 'CHKExternalURL', 'IDObjID'],
          tablename: 'CORE-DokuMaster',
          campoparticion: 'DokuMasterParticion',
          // @ts-expect-error CPXMetodos-global-const
          valueparticion: `${CPXMetodos.infoUser.IDCpanaxID}#${props.formItem.rowSession.SRCIDBaseField}`,
          // Para buscar por mas de un ID en la clave de particion
          // isListValueParticion:true,
          // valueparticion: 'value1;value2;value3',
          // idUnionParticion: `${CPXMetodos.infoUser.IDCpanaxID}#`,//Lo que hace arriba es unir el IDCpanaxID#Value1

          // Para buscar por mas de un Valor por la clave de ordenacion
          isListValueFiltro: true,
          valuefiltro: 'APPDKGAVSIMX;APPDKGAVSIMZ',
          campofiltro: 'IDDokuSubGroup',
        },
        false,
        source
      );
      // console.log(response);

      /* const response = await ApiPostAsync(
          '@Vulture getfilefilterbysubgroup',
          {
            isFullResponse: true,
            SRCIDBaseField: this.props.formItem.rowSession.SRCIDBaseField,
            subgroups: ['APPDKGAVSIMX', 'APPDKGAVSIMZ'],
          },
          source
        ); */

      if (response.Error === currR.cancellationMessage) return;

      currR.remove(keySource);

      if (response.Error) {
        console.log('Ocurrio un error en el fetch de los avatars del Doku: ', response.Error);
      } else {
        setState((prevState) => {
          const newImages: any = parseAndReturnObj(response.Result, 'array');
          const newFiles = [
            ...prevState.files.filter(
              ({ IDDokuSubGroup }) => !AvatarSubGroups.includes(IDDokuSubGroup)
            ),
            ...newImages,
          ];

          return {
            files: newFiles,
            PopperUseAs: null,
            avatarUpdateNumber: prevState.avatarUpdateNumber + 1,
          };
        });
        props.formItem.eventForm?.();
      }
    },

    handleCancelAllFeths: () => {
      get().currR.cancelAll();
    },

    handleMoveGroup: async (selectedToMoveGroup, noFromModal = false) => {
      const state = get();
      const {
        formItem,
        ModalMoveGroup,
        user,
        service,
        currR,
        getSelectedFile,
        getSubGroupFromFile,
        updateFileData,
      } = state;

      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return false;

      if (!ModalMoveGroup && !noFromModal) {
        setState({ ModalMoveGroup: true });
      } else {
        const NEWIDDokuSubGroup = getSubGroupFromFile(
          SLTFile.Doku_Ref,
          {
            IDDokuGroup: selectedToMoveGroup,
          },
          SLTFile.CHKExternalURL ? 'xytb' : undefined
        );

        if (!NEWIDDokuSubGroup) {
          return window.EventBus.invokeOnAlertStore(
            'showNotification',
            'El grupo seleccionado no soporta la extensión del archivo',
            'CPXDoku',
            'error'
          );
        }

        const rowToService = {
          entidad: JSON.stringify({
            ...SLTFile,
            NEWIDDokuGroup: selectedToMoveGroup,
            NEWIDDokuSubGroup,
            SRCIDObjCode: formItem.rowSession.IDObjCode,
            SRCIDBaseField: formItem.rowSession.SRCIDBaseField,
          }),
          IDCpanaxID: user.IDCpanaxID,
        };

        console.log('Entidad para actualizar el grupo: ', rowToService);

        MainLoaderIndicator(true, 'CPXDoku');

        try {
          const res = await service.externalpost(
            `${AppConstants().Vulture}updatedokugroup`,
            rowToService
          );

          console.log('Response move group: ', res);

          MainLoaderIndicator(false, 'CPXDoku');

          setState({ thereSomeChange: true });

          window.EventBus.invokeOnAlertStore(
            'showNotification',
            '¡Archivo Movido de Grupo Correctamente!',
            'CPXDoku'
          );

          updateFileData(
            fileID,
            {
              IDDokuGroup: selectedToMoveGroup,
              IDDokuSubGroup: NEWIDDokuSubGroup,
            },
            { ModalMoveGroup: false }
          );
        } catch (error: any) {
          MainLoaderIndicator(false, 'CPXDoku');

          if (error.message !== currR.cancellationMessage) {
            console.log('Ocurrio un error al intentar mover de grupo el archivo');
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              'No se pudo mover de grupo el Archivo',
              'CPXDoku',
              'error'
            );
          }

          return false;
        }
      }

      return true;
    },

    handleUseAs: async (event, selectedToUseAs) => {
      const state = get();
      const {
        selectedFiles,
        formItem,
        PopperUseAs,
        DKConfig,
        user,
        currR,
        getSelectedFile,
        updateDokuAvatars,
      } = state;

      const SLTFile = getSelectedFile(selectedFiles[0]);

      if (!SLTFile) return;

      if (!PopperUseAs) {
        setState({
          PopperUseAs: {
            onClose: () => setState({ PopperUseAs: null }),
            anchorEl: event?.currentTarget,
            arrow: { color: 'var(--BackgroundColor1)' },
            placement: 'bottom-end',
            styles: {
              color: '#ffffff',
              backColor: 'var(--BackgroundColor1)',
              borderRadius: '8px',
            },
            closeOutside: true,
            spreadDimensions: false,
          },
        });
      } else if (PopperUseAs && !selectedToUseAs) {
        setState({ PopperUseAs: null });
      } else {
        MainLoaderIndicator(true);

        const rowToService = {
          fromarchive: SLTFile,
          toarchive: {
            idloginuser: user.IDLoginUser,
            idcpanaxid: user.IDCpanaxID,
            IDDokuSubGroup: selectedToUseAs,
            IDDokuGroup: 'APPDKGAV',
            objid: formItem.rowSession.SRCIDBaseField,
            objcode: formItem.rowSession.IDObjCode,
          },
          IDAPIDataCloudProvider: DKConfig.IDAPIDataCloudConexion,
          IDCpanaxID: user.IDCpanaxID,
        };

        const res: any = await ApiPostAsync('@Vulture duplicateto', rowToService);
        const resObj: any = parseAndReturnObj(res.result);

        MainLoaderIndicator(false);

        if (res.error || resObj.error) {
          if (res.error || resObj.error === currR.cancellationMessage) return;

          console.log(
            'Ocurrio un error al realizar el use as de la imagen: ',
            res.error || resObj.error
          );
          return window.EventBus.invokeOnAlertStore(
            'showNotification',
            'Ocurrió un error',
            'CPXDoku',
            'error'
          );
        }

        window.EventBus.invokeOnAlertStore(
          'showNotification',
          '¡Cambios realizados correctamente!',
          'CPXDoku'
        );

        updateDokuAvatars();
      }

      return true;
    },

    handleEditFileName: (newName) => {
      const state = get();
      const { formItem, ModalEditFile, user, service, currR, getSelectedFile, updateFileData } =
        state;

      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      if (ModalEditFile) {
        if (!SLTFile.CHKExternalURL) {
          const extensionOld = SLTFile.Doku_Ref.match(/\.[0-9a-z]+$/i)[0].toLowerCase();

          newName = `${newName}${extensionOld}`;
        }

        const validName = validFileName(newName);

        if (!validName) {
          window.EventBus.invokeOnAlertStore(
            'showNotification',
            '¡Nombre del archivo no válido!',
            'CPXDoku'
          );
          return;
        }

        const ESIndex =
          `${user.IDCpanaxID}${formItem.rowSession.SRCIDObjCode}${formItem.rowSession.SRCIDBaseField}`.toLowerCase();
        const rowToService = {
          entidad: JSON.stringify({
            ...SLTFile,
            index: ESIndex,
            NEWDoku_Ref: newName,
            SRCIDObjCode: formItem.rowSession.IDObjCode,
            SRCIDBaseField: formItem.rowSession.SRCIDBaseField,
          }),
        };

        MainLoaderIndicator(true, 'CPXDoku');

        service
          .externalpost(`${AppConstants().Vulture}updatedokuname`, rowToService)
          .then(() => {
            MainLoaderIndicator(false, 'CPXDoku');

            setState({ thereSomeChange: true });

            window.EventBus.invokeOnAlertStore(
              'showNotification',
              '¡Se actualizó correctamente!',
              'CPXDoku'
            );

            updateFileData(fileID, { Doku_Ref: newName }, { ModalEditFile: false });
          })
          .catch((error: any) => {
            MainLoaderIndicator(false, 'CPXDoku');

            if (error.message === currR.cancellationMessage) return;

            console.log('Ocurrio un error al intentar actualizar el nombre del archivo: ', error);
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              'No se pudo actualizar el nombre del archivo',
              'CPXDoku',
              'error'
            );
          });
      } else {
        setState({ ModalEditFile: true });
      }
    },

    handleDeleteFile: (confirmed) => {
      const state = get();
      const { files, formItem, selectedFiles, user, service, getSelectedFile } = state;

      const SLTFile = getSelectedFile();
      if (!SLTFile && selectedFiles.length === 0) return;

      if (!confirmed) {
        setState({ ModalConfirmDelete: true });
      } else {
        setState({ ModalConfirmDelete: false });
        MainLoaderIndicator(true, 'CPXDoku');

        const filesToDelete =
          selectedFiles.length > 0
            ? selectedFiles
                .map((IDDoku) => files.find((file) => IDDoku === file.IDDoku))
                .map(({ IDDoku, Doku_Ref }) => ({ IDDoku, Doku_Ref }))
            : [{ IDDoku: SLTFile.IDDoku, Doku_Ref: SLTFile.Doku_Ref }];

        const ESIndex =
          `${user.IDCpanaxID}${formItem.rowSession.SRCIDObjCode}${formItem.rowSession.SRCIDBaseField}`.toLowerCase();
        const rowToService = {
          entidad: JSON.stringify({
            index: ESIndex,
            deletebulk: filesToDelete,
            SRCIDObjCode: formItem.rowSession.IDObjCode,
            SRCIDBaseField: formItem.rowSession.SRCIDBaseField,
          }),
          IDCpanaxID: user.IDCpanaxID,
        };

        if (filesToDelete.length === 0 || !filesToDelete[0].IDDoku) {
          return window.EventBus.invokeOnAlertStore(
            'showNotification',
            '¡Ocurrio un error Doku!',
            'CPXDoku',
            'error'
          );
        }

        service
          .externalpost(`${AppConstants().Vulture}deteleteavatar`, rowToService)
          .then(({ data }: any) => {
            MainLoaderIndicator(false, 'CPXDoku');
            console.log('Response deleted files: ', data);

            if (data.error) {
              console.log(
                'Ocurrio un error, no se pudo eliminar los archivos seleccionados: ',
                data.error
              );
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                '¡Ocurrio un error!',
                'CPXDoku',
                'error'
              );
            } else {
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                'Archivos Eliminados Correctamente',
                'CPXDoku'
              );
              const { response } = data;

              const errorInDelete = response.deletedFiles.map(({ IDDoku }: any) => IDDoku);

              let { files: newFilesList } = state;

              newFilesList = newFilesList.filter(
                ({ IDDoku }) =>
                  errorInDelete.includes(IDDoku) ||
                  !filesToDelete.some((fileD) => IDDoku === fileD.IDDoku)
              );

              setState({
                files: newFilesList,
                fileID: null,
                ModalDoku: null,
                selectedFiles: selectedFiles.filter((IDDoku) => errorInDelete.includes(IDDoku)),
              });
            }
          })
          .catch((error: any) => {
            MainLoaderIndicator(false, 'CPXDoku');
            console.log(
              'Ocurrio un error, no se pudo eliminar los archivos seleccionados: ',
              error
            );
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              '¡Ocurrio un error!',
              'CPXDoku',
              'error'
            );
          });
      }
    },

    handleClosePanel: () => {
      setState({ ModalDoku: null, fileID: null });
    },

    handleClickReload: () => {
      const state = get();
      const { clearPagValues, isUploadingFile, handleCancelAllFeths, DoFetches } = state;
      if (state.isLoadingGroups) return;

      clearPagValues();

      const canReload = !isUploadingFile();

      if (canReload) {
        setState({ groupsInfo: [] });

        handleCancelAllFeths();
        DoFetches(true);
      } else {
        window.EventBus.invokeOnAlertStore(
          'showNotification',
          'No se puede actualizar el DOKU mientras subes un archivo',
          'CPXDoku',
          'error'
        );
      }
    },

    handleDeleleListUploadFile: (file, callback = () => {}) => {
      const state = get();
      const { myDropzone } = state;
      const existInDropZone = myDropzone.getAcceptedFiles().some(({ id }: any) => id === file.id);
      if (existInDropZone) {
        myDropzone.removeFile(file);
      }

      let { listUploadFiles } = state;
      listUploadFiles = listUploadFiles.filter(
        ({ id, IDDoku }) => file.id !== id || (IDDoku && file.IDDoku && IDDoku !== file.IDDoku)
      );
      setState({ listUploadFiles });
      callback();
    },

    handleInitUpload: () => {
      get().myDropzone.processQueue();
    },

    handleConvertFile: () => {
      const state = get();
      const { files, fileID, user, service, updateFileData } = state;
      const file = files.find(({ IDDoku }) => fileID === IDDoku);

      if (file) {
        MainLoaderIndicator(true);

        const rowToService = {
          imagetocompress: {
            ojbcode: file.IDObjCode,
            objid: file.IDObjID,
            iddoku: file.IDDoku,
            imagename: file.Doku_Ref,
            sizeoriginal: file.Doku_FileSize,
            Doku_UrlUbi: file.Doku_UrlUbi,
          },
          IDCpanaxID: user.IDCpanaxID,
        };

        service
          .externalpost('@Heron cpxconvertaloneimage', rowToService)
          .then(({ data }: any) => {
            MainLoaderIndicator(false);

            if (!data.imagename || !data.url) {
              console.log('Ocurrio un error al convertir la imagen: ', data);
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                '¡Ocurrió un error! No se pudo convertir a webp el archivo',
                'CPXDoku',
                'error'
              );
            } else {
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                'Archivo Convertido Correctamente',
                'CPXDoku'
              );
              updateFileData(file.IDDoku, {
                Doku_Ref: data.imagename,
                Doku_FileSize: data.pesonuevo,
                IDDokuClase: 'DKCWEP',
                Doku_UrlUbi: data.url,
                Doku_Optimizer: 1,
              });
            }
          })
          .catch((error: any) => {
            console.log('Ocurrio un error al intentar comprimir el archivo: ', error);
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              '¡Ocurrió un error! No se pudo comprimir el archivo',
              'CPXDoku',
              'error'
            );
            MainLoaderIndicator(false);
          });
      }
    },

    handleChangeCompress: (id, value) => {
      setState({ [id]: value });
    },

    handleCompressFile: () => {
      const state = get();
      const { files, fileID, user, service, updateFileData } = state;
      const file = files.find(({ IDDoku }) => fileID === IDDoku);

      if (file) {
        MainLoaderIndicator(true);

        const rowToService = {
          imagetocompress: {
            ojbcode: file.IDObjCode,
            objid: file.IDObjID,
            iddoku: file.IDDoku,
            imagename: file.Doku_Ref,
            sizeoriginal: file.Doku_FileSize,
            Doku_UrlUbi: file.Doku_UrlUbi,
          },
          IDCpanaxID: user.IDCpanaxID,
        };

        service
          .externalpost('@Heron cpxcompressimage', rowToService)
          .then(({ data }: any) => {
            MainLoaderIndicator(false);

            console.log('Response service image compresion: ', data);

            if (data.error) {
              console.log('Ocurrio un error al comprimir la imagen: ', data.error);
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                '¡Ocurrió un error! No se pudo comprimir el archivo',
                'CPXDoku',
                'error'
              );
            } else {
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                'Archivo Comprimido Correctamente',
                'CPXDoku'
              );
              updateFileData(file.IDDoku, {
                Doku_FileSize: data.response.pesonuevo,
                Doku_UrlUbi: data.response.url,
                Doku_Optimizer: 1,
              });
            }
          })
          .catch((error: any) => {
            console.log('Ocurrio un error al intentar comprimir el archivo: ', error);
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              '¡Ocurrió un error! No se pudo comprimir el archivo',
              'CPXDoku',
              'error'
            );
            MainLoaderIndicator(false);
          });
      }
    },

    handleChangeTab: (tab) => {
      setState({ selectedTab: tab.id, selectedFiles: [] });
      get().CtrlContentScrollTo(0);
    },

    handleInputSearch: (text) => {
      if (get().IS_SSEARCH) return;

      get().clearPagValues();
      setState({ filterItems: text });
    },

    handleKeyPressSearch: (event) => {
      if (!get().IS_SSEARCH) return;

      const text = event.target.value;

      if (event.nativeEvent.shiftKey || event.nativeEvent.keyCode !== 13) return;

      event.preventDefault();

      get().fetchSSearch(text);
    },

    handleCloseMdlFile: () => {
      const state = get();
      const { getSelectedFile, updateFileData } = state;
      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      const objToUpdate: any = {};

      if (SLTFile.processAnalysis >= 2 && SLTFile.processAnalysis <= 4) {
        objToUpdate.processAnalysis = 2;
      }

      updateFileData(fileID, objToUpdate, { fileID: null });
    },

    handleClose: () => {
      const state = get();
      const { thereSomeChange, props } = state;
      if (thereSomeChange && typeof props.onCloseAndRefresh === 'function') {
        props.onCloseAndRefresh();
      } else if (typeof props.onClose === 'function') {
        props.onClose();
      }
    },

    handleClickFileItem: (file) => () => {
      const state = get();
      const { props, updateFileData, handleFetchAnalysis } = state;
      if (state.isCmdPressed) return;

      const { isAnalizer } = props;

      if (!isAnalizer) {
        setState({ fileID: file.IDDoku });
        return;
      }

      const doRequestAnalize =
        Boolean(file.providerSelected || file.IDIAVisionTextAnalyzer) &&
        ((file.processAnalysis === 2 && !file.fetchAnalysis.includes('loaded')) ||
          file.processAnalysis === 0);

      updateFileData(
        file.IDDoku,
        {
          processAnalysis: doRequestAnalize ? 2 : file.processAnalysis,
        },
        { fileID: file.IDDoku },
        () => {
          if (doRequestAnalize) handleFetchAnalysis();
        }
      );
    },

    handleSelectFile: (file) => (event) => {
      const state = get();
      event.stopPropagation();

      const { selectedFiles, isCmdPressed } = state;
      const idFile = file.IDDoku;
      let filesId = copyValue(selectedFiles);

      const indexSelected = filesId.indexOf(idFile);
      const alreadySelected = indexSelected !== -1;

      if (alreadySelected) {
        if (isCmdPressed) {
          filesId.splice(indexSelected, 1);
        } else if (filesId.length > 1) {
          filesId = [idFile];
        }
      } else {
        if (filesId.length === 0 || !isCmdPressed) {
          filesId = [idFile];
        } else {
          filesId.push(idFile);
        }
      }

      setState({ selectedFiles: filesId });
    },

    handleSelectAllGroup: (group) => (event) => {
      const state = get();
      if (!state.isCmdPressed) return;

      event.stopPropagation();

      const { files } = state;

      const filesId = files
        .filter(({ IDDokuSubGroup }) => group.IDDokuSubGroup === IDDokuSubGroup)
        .map(({ IDDoku }) => IDDoku);

      if (filesId.length > 0) {
        setState({ selectedFiles: filesId });
      }
    },

    handleClickContent: () => {
      const state = get();
      const { selectedFiles } = state;

      if (selectedFiles.length > 0) {
        setState({ selectedFiles: [] });
      }
    },

    /* ANALYSYS FUNCTIONS - START */

    handleFetchAnalysis: async (isFromCli = false, forceToServer = false) => {
      const state = get();
      const {
        formItem,
        user,
        currR,
        service,
        getSelectedFile,
        updateFileData,
        getFetchQuery,
        handleBuildJSONKeys,
        handleClickBox,
      } = state;

      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      if (SLTFile.processAnalysis !== 2) return;

      const prevStatusFetchAnalysis = SLTFile.fetchAnalysis;
      let currentFetchedClaves = false;

      updateFileData(fileID, { fetchAnalysis: 'loading-config' });

      // Si previamente ya no se hizo un request para buscar este analisis en la base de datos
      if (!SLTFile.AIItemAnalysis && SLTFile.IDIAVisionTextAnalyzer) {
        const prevAnalysis = await getFetchQuery(
          { IDIAVisionTextAnalyzer: SLTFile.IDIAVisionTextAnalyzer },
          'Q0001637203011123882452',
          { sourceName: 'FetchAnalysis1' }
        );

        console.log('Response prevanalysis: ', prevAnalysis);

        SLTFile.AIItemAnalysis = copyValue(prevAnalysis);

        if (prevAnalysis.IDIAVisionTextAnalyzer) {
          updateFileData(fileID, { AIItemAnalysis: prevAnalysis });
        }
      }

      if (!SLTFile.providerSelected && SLTFile.IDIAVisionTextAnalyzer && SLTFile.AIItemAnalysis) {
        updateFileData(fileID, { fetchedProvider: 'loading' });

        const Provider = await getFetchQuery(
          { IDFNZSupplier: SLTFile.AIItemAnalysis.IDObjID },
          'Q0001637227499129216050',
          { sourceName: 'FetchAnalysis2' }
        );

        if (Provider.IDFNZSupplier) {
          Provider.SRCIDBaseField =
            Provider.SRCIDBaseField || Provider.IDObjID || Provider.IDBaseField;
          Provider.IDObjID = Provider.SRCIDBaseField;
          Provider.IDBaseField = Provider.SRCIDBaseField;

          SLTFile.providerSelected = copyValue(Provider);

          updateFileData(fileID, {
            providerSelected: copyValue(Provider),
            fetchedProvider: 'already-exist',
          });
        } else {
          updateFileData(fileID, { fetchedProvider: false });
        }
      }

      if (!SLTFile.isFetchedClaves && SLTFile.providerSelected) {
        // Cargamos las keys
        const entity = { ...formItem.rowSession, ...SLTFile.providerSelected };

        const keys = await getFetchQuery(entity, 'Q0001637193535254131071', {
          array: true,
          sourceName: 'FetchAnalysis3',
        });

        SLTFile.claves = copyValue(keys);
        SLTFile.JSONKeys = copyValue(keys).map((clave: any) => handleBuildJSONKeys(clave, null));

        currentFetchedClaves = true;
      }

      if (!SLTFile.isFetchedSync && SLTFile.AIItemAnalysis) {
        const prevAsync = await getFetchQuery(
          { IDDoku: SLTFile.IDDoku },
          'Q0001637230753998286895',
          { sourceName: 'FetchAnalysis2-1' }
        );

        console.log({ prevAsync });

        if (prevAsync.IDFNZPOBookID) {
          let FielsFromAI = parseAndReturnObj(
            SLTFile.AIItemAnalysis.IAVisionTextAnalyzerJSON,
            'array'
          );

          if (FielsFromAI && Array.isArray(FielsFromAI) && FielsFromAI.length) {
            FielsFromAI = FielsFromAI.map(({ idClave }) =>
              SLTFile.claves.find((clave: any) => idClave === clave.IDIAVisionTextModelKey)
            )
              .filter((clave) => Boolean(clave && clave.IAVisionTextFormField))
              .map(({ IAVisionTextFormField }) => IAVisionTextFormField);
          } else {
            FielsFromAI = [];
          }

          if (!SLTFile.isEditingAI) {
            updateFileData(fileID, {
              fetchAnalysis: 'standby',
              processAnalysis: SLTFile.AIItemAnalysis.IDIAVisionTextMode === 'MNX' ? 1 : 5,
              AIItemSync: prevAsync,
              AIFieldsSync: FielsFromAI,
            });
            return;
          } else {
            updateFileData(fileID, {
              AIItemSync: prevAsync,
              AIFieldsSync: FielsFromAI,
            });
          }
        }
      }

      if (currentFetchedClaves) {
        updateFileData(fileID, {
          claves: SLTFile.claves,
          JSONKeys: SLTFile.JSONKeys,
          isFetchedClaves: true,
        });
      }

      const JSONKeysFiltered = SLTFile.JSONKeys.filter(({ KeyType }: any) => KeyType !== 'KMX');
      const isValidFileToAnalize =
        SLTFile.providerSelected && SLTFile.providerSelected.IDObjID && JSONKeysFiltered.length;

      const isValidMomentToAnalize =
        SLTFile.fetchAnalysis === 'standby' ||
        SLTFile.fetchAnalysis === 'error' ||
        isFromCli ||
        forceToServer;

      if (isValidFileToAnalize && isValidMomentToAnalize) {
        // Valida que tenga un modelo, si no lo tiene entonces hace el query para obtener el modelo del archivo
        const DModeler =
          SLTFile.modeler && SLTFile.modeler.IDIAVisionTextModeler
            ? SLTFile.modeler
            : await getFetchQuery(
                {
                  ...formItem.rowSession,
                  SRCIDBaseField: SLTFile.providerSelected.IDObjID,
                },
                'Q0001637194693316835126',
                { sourceName: 'FetchAnalysis4' }
              );

        let isPrevAnalysis = true;
        let matchKeys: any = null;
        let blocks: any = null;

        const noValidDataAnalysis = () =>
          Boolean(!blocks || !Array.isArray(blocks) || !blocks.length);

        if (SLTFile.AIItemAnalysis) {
          isPrevAnalysis = true;

          matchKeys = parseAndReturnObj(SLTFile.AIItemAnalysis.IAVisionTextAnalyzerJSON);
          if (!matchKeys || !Array.isArray(matchKeys)) matchKeys = [];

          matchKeys = matchKeys.map((clave: any) => {
            let objClave = {
              ...clave,
              Valor: clave.Text,
              idBlock: null,
              confidence: null,
            };

            if (clave.KeyType !== 'KMX') {
              objClave = {
                ...objClave,
                idBlock: RandomStr(21),
                confidence: clave.Confidence,
              };
            }

            return objClave;
          });

          const prevDimensions: any = parseAndReturnObj(
            SLTFile.AIItemAnalysis.AISystemDimensionsJSON
          );

          blocks = matchKeys
            .filter(({ KeyType }: any) => KeyType !== 'KMX')
            .map((clave: any) => ({
              Id: clave.idBlock,
              Text: clave.Text,
              idClave: clave.idClave,
              Confidence: clave.confidence,
              BoundingBox: prevDimensions.width
                ? getImgPosition(fileID, clave.BoundingBox, prevDimensions)
                : clave.BoundingBox,
              BlockType: clave.BlockType,
            }));
        }

        // Si no existe ningun analisis para este registro, entonces se procede a analisar con amazon
        if (!SLTFile.AIItemAnalysis || noValidDataAnalysis() || isFromCli || forceToServer) {
          updateFileData(fileID, { fetchAnalysis: 'loading-AI' });
          isPrevAnalysis = false;

          // Se hace el request al servicio de node que hace el analisis del documento
          const rowToService = {
            url: SLTFile.Doku_UrlUbi,
            modeler: JSON.stringify(SLTFile.JSONKeys),
            typeimage: SLTFile.IDDokuClase,
            entidad: JSON.stringify({
              ...SLTFile,
              SRCIDObjCode: formItem.rowSession.IDObjCode,
              SRCIDBaseField: formItem.rowSession.SRCIDBaseField,
              IDIAVisionTextModeler: DModeler.IDIAVisionTextModeler,
              IDIAVisionTextModelContext: formItem.rowSession.IDIAVisionTextModelContext,
              ...SLTFile.providerSelected,
            }),
            IDCpanaxID: user.IDCpanaxID,
          };

          try {
            const { id: keySource, source } = currR.add();

            const res = await service.externalpost(
              `${AppConstants().URLAI}${!isFromCli ? 'api/textract' : 'api/textractfromcli'}`,
              rowToService,
              { cancelToken: source.token }
            );

            currR.remove(keySource);

            if (res && res.data) {
              matchKeys =
                res.data.elfiltro &&
                res.data.elfiltro.arraytext &&
                Array.isArray(res.data.elfiltro.arraytext)
                  ? res.data.elfiltro.arraytext
                  : [];
              blocks = res.data.block;
            } else {
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                '¡Sin respuesta del servicio de Análisis!',
                'CPXDoku',
                'error'
              );

              updateFileData(fileID, { fetchAnalysis: 'error' });
              return;
            }
          } catch (error: any) {
            if (error.message === currR.cancellationMessage) return;

            console.log(
              'Ocurrio un error al intentar obtener el texto de la imagen: ',
              error.message
            );
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              '¡Ocurrió un error al analizar el documento!',
              'CPXDoku',
              'error'
            );

            updateFileData(fileID, { fetchAnalysis: 'error' });

            return;
          }
        }

        if (noValidDataAnalysis()) {
          window.EventBus.invokeOnAlertStore(
            'showNotification',
            '¡No se encontró data en el análisis!'
          );

          updateFileData(fileID, {
            fetchAnalysis: 'loaded-empty',
            isAIModifiedDim: false,
          });
          return;
        }

        const JSONKeys = SLTFile.JSONKeys.map((clave: any) => {
          const alreadySet = matchKeys.filter(({ idClave }: any) => clave.idClave === idClave);

          if (alreadySet.length) {
            const claveNew = alreadySet[0];
            const Text = alreadySet.map(({ Valor }: any) => Valor).join(';');

            if (!isFromCli) {
              return {
                ...clave,
                TextVerify: claveNew.TextVerify || clave.TextVerify,
                HumanInLoop: claveNew.HumanInLoop || clave.HumanInLoop,
                HumanBox: claveNew.HumanBox || clave.HumanBox,
                HumanText: claveNew.HumanText || clave.HumanText,
                isCheckEdit: claveNew.isCheckEdit || clave.isCheckEdit,

                Id: claveNew.idBlock,
                Text,
                TextOriginal: claveNew.TextOriginal || Text,
                Confidence: claveNew.confidence,
                BoundingBox: claveNew.BoundingBox,
                BlockType: claveNew.BlockType || 'WORD',
              };
            } else {
              return {
                ...clave,
                Id: claveNew.idBlock,
                TextOriginal: Text,
                Confidence: claveNew.confidence,
                BoundingBox: claveNew.BoundingBox,
                BlockType: claveNew.BlockType || 'WORD',
              };
            }
          } else {
            return {
              ...clave,
              Id: null,
              Text: null,
              TextOriginal: null,
              Confidence: null,
              BoundingBox: null,
              BlockType: null,
            };
          }
        });

        const BlocksBox = blocks.map(({ Geometry, ...another }: any) => {
          const alreadySet = matchKeys.find(({ idBlock }: any) => another.Id === idBlock);

          if (typeof alreadySet !== 'undefined') {
            return {
              Id: alreadySet.idBlock,
              Text: alreadySet.Valor,
              idClave: alreadySet.idClave,
              Confidence: alreadySet.confidence,
              BoundingBox: alreadySet.BoundingBox,
              BlockType: alreadySet.BlockType || 'WORD',
            };
          } else {
            return {
              BoundingBox: Geometry ? Geometry.BoundingBox : another.BoundingBox,
              ...another,
            };
          }
        });

        const Doku_TextractBlock: any[] = [];

        BlocksBox.forEach((block: any) => {
          const alreadySet = Doku_TextractBlock.find(
            ({ idClave }) => Boolean(block.idClave) && Boolean(idClave) && block.idClave === idClave
          );

          if (typeof alreadySet !== 'undefined') {
            alreadySet.Text += ` ${block.Text}`;
          } else {
            Doku_TextractBlock.push(block);
          }
        });

        updateFileData(
          fileID,
          {
            fetchAnalysis: isPrevAnalysis ? 'loaded-prev' : 'loaded-new',
            modeler: DModeler,
            JSONKeys,
            Doku_TextractBlock,
            isAIModifiedDim: false,
          },
          {},
          () => {
            const { MDRInfoValSelected } = state;

            if (isFromCli && Boolean(MDRInfoValSelected) && MDRInfoValSelected.idClave) {
              const BlockItem = Doku_TextractBlock.find(
                ({ idClave }) => MDRInfoValSelected.idClave === idClave
              );

              if (BlockItem) {
                handleClickBox(BlockItem);
              }
            }
          }
        );
      } else if (!isValidFileToAnalize) {
        updateFileData(fileID, {
          fetchAnalysis: 'standby',
          processAnalysis: 0,
        });
      } else if (!isValidMomentToAnalize) {
        updateFileData(fileID, {
          fetchAnalysis: prevStatusFetchAnalysis,
          processAnalysis: prevStatusFetchAnalysis.includes('loaded') ? 2 : 0,
        });
      }
    },

    handleSaveKeysForFile: async (
      isFormAnalizer = false,
      { wayAnalisys, isManual = false } = {}
    ) => {
      const state = get();
      const {
        formItem: { rowSession },
        user,
        getSelectedFile,
        updateFileData,
      } = state;

      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return false;

      const DModeler = SLTFile.modeler;
      const isNewModeler = typeof DModeler.IDIAVisionTextModeler === 'undefined';

      const analizer = SLTFile.AIItemAnalysis;
      const isNewAnalysis = !analizer;

      const KeysNeccesaryToProcess = [
        'IDObjCode',
        'IDIAVisionTextModelContext',
        'IDAPIDataCloudServiceProvider',
        'CPXRSKDateCreate',
        'CPXRSKLoginUserCreateBy',
      ];
      const haveNeccesaryDataFromContext = Boolean(SLTFile.providerSelected.IDObjID);
      const haveNeccesaryData =
        KeysNeccesaryToProcess.every((KeyData) => Boolean(rowSession[KeyData])) &&
        haveNeccesaryDataFromContext;

      if (!haveNeccesaryData) {
        const listKeys = KeysNeccesaryToProcess.join('\n');
        window.EventBus.invokeOnAlertStore(
          'showNotification',
          `No se pueden guardar los datos, por favor verifica que hayas definido las siguientes variables: \n ${listKeys}`,
          'CPXDoku',
          'error'
        );
        return false;
      }

      let JSONKeysToSave = [];
      let dimensionsImg = {};

      if (!isManual) {
        JSONKeysToSave =
          SLTFile.JSONKeys || (analizer.JSONKeys && parseAndReturnObj(analizer.JSONKeys));
        JSONKeysToSave = JSONKeysToSave.filter(
          ({ idClave, refClave, BoundingBox, KeyType }: any) =>
            Boolean(idClave) && Boolean(refClave) && (KeyType === 'KMX' || Boolean(BoundingBox))
        );

        console.log('Keys to save: ', JSONKeysToSave);

        const $img: any = getImgElement(fileID);
        if (!$img) {
          window.EventBus.invokeOnAlertStore(
            'showNotification',
            "No se encontró la 'DOM reference' a la imagen.",
            'CPXDoku',
            'error'
          );
          return false;
        }

        dimensionsImg = {
          width: $img.width,
          height: $img.height,
          naturalWidth: $img.naturalWidth,
          naturalHeight: $img.naturalHeight,
        };
      }

      let newModeler: any = {
        IDObjCode: rowSession.IDObjCode,
        IDObjID: SLTFile.providerSelected.IDObjID,
        IDIAVisionTextModelContext: rowSession.IDIAVisionTextModelContext,
        IDAPIDataCloudServiceProvider: rowSession.IDAPIDataCloudServiceProvider,
        IDDoku: SLTFile.IDDoku,
        AISystemDimensionsJSON: JSON.stringify(dimensionsImg),
        CPXRSKDateCreate: rowSession.CPXRSKDateCreate,
        CPXRSKDateUpdate: new Date().toISOString(),
        CPXRSKLoginUserCreateBy: rowSession.CPXRSKLoginUserCreateBy,
        CPXRSKLoginUserUpdateBy: user.IDLoginUser,
      };

      let idFrm = 'Frm0001637191863102699752';

      if (isFormAnalizer) {
        idFrm = 'Frm0001637194643838933542';

        newModeler = {
          IDIAVisionTextMode: isManual ? 'MNX' : 'AUT',
          IDIAVisionTextAnalyzer: !isNewAnalysis ? analizer.IDIAVisionTextAnalyzer : '',
          IDAPIDataCloudConexion: !isNewAnalysis ? analizer.IDAPIDataCloudConexion : '',
          IAVisionTextAnalyzerJSON: JSON.stringify(JSONKeysToSave),
          IDIAVisionTextAnalyzerStatus: wayAnalisys || '',
          ...newModeler,
        };
      } else {
        newModeler = {
          IDIAVisionTextModeler: !isNewModeler ? DModeler.IDIAVisionTextModeler : '',
          IAVisionTextModelerRef: !isNewModeler ? DModeler.IAVisionTextModelerRef : '',
          IAVisionTextModelerComment: !isNewModeler
            ? DModeler.IAVisionTextModelerComment || ''
            : '',
          IAVisionTextModelAnalyzerJSON: JSON.stringify(JSONKeysToSave),
          CHKActivo: true,
          ...newModeler,
        };
      }

      const isNuevo = isFormAnalizer ? isNewAnalysis : isNewModeler;
      const data = {
        Row: newModeler,
        isNuevo,
        idfrm: idFrm,
        idSes: `s${new Date().getTime()}`,
        IsSaveAs: false,
        isFilterByNew: isNuevo,
      };

      MainLoaderIndicator(true, 'Forms');
      // console.log('Se dispara este',isNuevo, idFrm)
      const response = await ApiPostCompressAsync(
        `${AppConstants().URLForms}GetItem_SaveForm`,
        data
      );

      MainLoaderIndicator(false, 'Forms');

      if (response.Error) {
        window.EventBus.invokeOnAlertStore('showNotification', response.Error, 'CPXDoku', 'error');

        return false;
      } else {
        window.EventBus.invokeOnAlertStore('showNotification', 'Información Guardada', '');

        const obj = JSON.parse(response.Result);
        console.log(
          'Guardada',
          !isNewAnalysis ? analizer.IDIAVisionTextAnalyzer : obj.IDIAVisionTextAnalyzer
        );

        if (!isFormAnalizer) {
          updateFileData(fileID, { modeler: obj }, {});
        } else {
          MainLoaderIndicator(true, 'Forms');
          const JobUpdate = await ApiPostCompressAsync(`${AppConstants().URLProcesos}ProcessJobs`, {
            IDQueryJob: 'QJ0001637225770599855347',
            row: {
              IDDoku: SLTFile.IDDoku,
              IDIAVisionTextAnalyzer: !isNewAnalysis
                ? analizer.IDIAVisionTextAnalyzer
                : obj.IDIAVisionTextAnalyzer,
            },
          });
          MainLoaderIndicator(false, 'Forms');

          if (JobUpdate.Error) {
            console.log(
              'Ocurrio un error al intentar setear el analisis para el documento: ',
              JobUpdate.Error
            );
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              '¡No se pudo establecer este análisis para el documento!',
              'CPXDoku',
              'error'
            );
          }

          updateFileData(fileID, {
            isAIModifiedDim: false,
            AIItemAnalysis: obj,
            IDIAVisionTextAnalyzer: obj.IDIAVisionTextAnalyzer,
          });
        }

        return true;
      }
    },

    handleSaveDataTextForFile: async () => {
      const state = get();
      const { AIConfig, formItem, getSelectedFile } = state;

      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      const objSaveForm: any = {};

      SLTFile.claves.forEach((clave: any) => {
        const inJsonKey = SLTFile.JSONKeys.find(
          ({ idClave }: any) => clave.IDIAVisionTextModelKey === idClave
        );

        if (inJsonKey && clave.IAVisionTextFormField) {
          let value = inJsonKey.Text;

          if (clave.KeyFormatValue === 'FCX' || clave.KeyFormatValue === 'XFD') {
            value = inJsonKey.Text ? String(inJsonKey.Text) : '';

            if (clave.KeyFormatValue === 'XFD') {
              value = parseDate(value, clave, true);
            }
          } else if (clave.KeyFormatValue === 'FND' || clave.KeyFormatValue === 'FNE') {
            value = parseNumber(value, clave);
          } else if (clave.KeyFormatValue === 'XVF') {
            // console.log('vacio')
          }

          objSaveForm[clave.IAVisionTextFormField] = value;
        }
      });

      console.log({ objSaveForm });

      const entidad = Object.assign(
        {
          IDDoku: SLTFile.IDDoku,
          IDIAVisionTextMode: 'AUT',
          IDIAVisionTextAnalyzer: SLTFile.IDIAVisionTextAnalyzer,
        },
        formItem.rowSession,
        SLTFile.providerSelected,
        objSaveForm
      );

      const isNew = Boolean(!SLTFile.AIItemSync || !SLTFile.AIItemSync.IDFNZPOBookID);

      if (!isNew) {
        entidad.IDFNZPOBookID = SLTFile.AIItemSync.IDFNZPOBookID;
      }

      const data = {
        Row: entidad,
        isNuevo: isNew,
        idfrm: AIConfig.VisionTextFormMaster,
        idSes: `s${new Date().getTime()}`,
        IsSaveAs: false,
        isFilterByNew: true,
      };

      MainLoaderIndicator(true, 'Forms');

      const response = await ApiPostCompressAsync(
        `${AppConstants().URLForms}GetItem_SaveForm`,
        data
      );

      MainLoaderIndicator(false, 'Forms');

      if (response.Error) {
        console.log('Ocurrio un error al sincronizar el archivo: ', response.Error);
        window.EventBus.invokeOnAlertStore('showNotification', response.Error, 'CPXDoku', 'error');
        return false;
      } else {
        window.EventBus.invokeOnAlertStore('showNotification', 'Análisis Sincronizado', '');

        const obj = JSON.parse(response.Result);

        return {
          FieldsSync: objSaveForm,
          ResultForm: obj,
        };
      }
    },

    handleClickBox: (item) => {
      const state = get();
      const { getSelectedFile, updateFileData } = state;
      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      const JSONKey = SLTFile.JSONKeys.find(({ Id }: any) => item.Id === Id);

      if (typeof JSONKey !== 'undefined') {
        item = copyValue(JSONKey);
      } else {
        item.idClave = null;
        item.refClave = null;
      }

      updateFileData(fileID, { processAnalysis: 3 }, { MDRInfoValSelected: item });
    },

    handleConfigKey: (Id) => {
      const state = get();
      const { getSelectedFile, handleClickBox } = state;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      if (SLTFile.Doku_TextractBlock) {
        const BlockKey = SLTFile.Doku_TextractBlock.find((block: any) => Id === block.Id);

        if (BlockKey) {
          handleClickBox(BlockKey);
        }
      }
    },

    handleChangeKeyForBox: (_n, value) => {
      const state = get();
      const { MDRInfoValSelected, getSelectedFile, updateFileData } = state;

      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      const clave = SLTFile.claves.find(
        ({ IDIAVisionTextModelKey }: any) => value === IDIAVisionTextModelKey
      );

      const claveJson = SLTFile.JSONKeys.find(({ idClave }: any) => value === idClave);
      const prevClaveJson = SLTFile.JSONKeys.find(
        ({ idClave }: any) => MDRInfoValSelected.idClave === idClave
      );

      if (clave && claveJson) {
        if (prevClaveJson) {
          // Coloca los valores de la clave previa establecia al boundingBox que esten relacionados al boundingBox a sus estado original
          // Ya que pasa a un estado de No Asignado
          prevClaveJson.Id = null;
          prevClaveJson.Text = null;
          prevClaveJson.HumanInLoop = '0';
          prevClaveJson.HumanBox = '0';
          prevClaveJson.HumanText = '0';
          prevClaveJson.TextOriginal = null;
          prevClaveJson.BoundingBox = null;
          prevClaveJson.Confidence = null;
          prevClaveJson.BlockType = null;
          prevClaveJson.isCheckEdit = false;
        }

        claveJson.Id = MDRInfoValSelected.Id;
        claveJson.Text = MDRInfoValSelected.Text;
        claveJson.BoundingBox = MDRInfoValSelected.BoundingBox;
        claveJson.HumanInLoop = MDRInfoValSelected.HumanInLoop;
        claveJson.HumanBox = MDRInfoValSelected.HumanBox;
        claveJson.HumanText = MDRInfoValSelected.HumanText;
        claveJson.TextOriginal = MDRInfoValSelected.Text;
        claveJson.Confidence = MDRInfoValSelected.Confidence;
        claveJson.BlockType = SLTFile.typeOfBoundingBox || 'WORD';
        claveJson.isCheckEdit = MDRInfoValSelected.isCheckEdit;

        updateFileData(
          fileID,
          { JSONKeys: SLTFile.JSONKeys },
          { MDRInfoValSelected: copyValue(claveJson) }
        );
      }
    },

    handleChangeKeyValue: (fieldOrValueObj, value, setAIAsModified = false) => {
      const state = get();
      const { getSelectedFile, updateFileData } = state;
      let { MDRInfoValSelected } = state;

      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      let claveBlock = SLTFile.Doku_TextractBlock.find(
        ({ Id }: any) => MDRInfoValSelected.Id === Id
      );
      let claveJson = SLTFile.JSONKeys.find(
        ({ idClave }: any) => MDRInfoValSelected.idClave === idClave
      );

      if (claveBlock) {
        if (typeof fieldOrValueObj === 'string') {
          if (claveJson) {
            claveJson[fieldOrValueObj] = value;
          }

          claveBlock[fieldOrValueObj] = value;
          MDRInfoValSelected[fieldOrValueObj] = value;
        } else {
          if (claveJson) {
            claveJson = Object.assign(claveJson, fieldOrValueObj);
          }

          claveBlock = Object.assign(claveBlock, fieldOrValueObj);
          MDRInfoValSelected = Object.assign(MDRInfoValSelected, fieldOrValueObj);
        }

        updateFileData(
          fileID,
          {
            Doku_TextractBlock: SLTFile.Doku_TextractBlock,
            JSONKeys: SLTFile.JSONKeys,
            isAIModifiedDim: setAIAsModified,
          },
          { MDRInfoValSelected }
        );
      }
    },

    handleChangeStepAnalizer: async (step, { isManual, wayAnalisys } = {}) => {
      const state = get();
      const {
        getSelectedFile,
        handleSaveKeysForFile,
        handleMoveGroup,
        getFetchQuery,
        updateFileData,
        handleSaveDataTextForFile,
      } = state;
      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      const { AIConfig } = state;

      // Proceso de edicion manual de las claves, pero en este punto se le dio guardar al formulario de edicion manual
      // Se procede a guardar el analisis de manera manual y a realizar el cambio de grupo a analizados para el documento
      if (step === 1) {
        const isSaveRight = await handleSaveKeysForFile(true, { isManual });

        if (isSaveRight) {
          const isNeccesaryMove = SLTFile.IDDokuGroup !== 'APPXAIXX';

          if (isNeccesaryMove) await handleMoveGroup('APPXAIXX', true);

          const saveAsync = await getFetchQuery(
            { IDDoku: SLTFile.IDDoku },
            'Q0001637230753998286895',
            { sourceName: 'FetchAnalysis2-1' }
          );

          console.log({ saveAsync });

          if (saveAsync.IDFNZPOBookID) {
            updateFileData(fileID, { AIItemSync: saveAsync });
            return;
          }
        }
      }
      // Paso donde se ven las keys y se ajustan detalles
      else if (step === 2) {
        updateFileData(fileID, { processAnalysis: 2 }, { MDRInfoValSelected: null });
      }
      // El siguiente paso seria pasar al checklist de verificacion
      // Pero primero se debe validar las keys requeridas
      else if (step === 4) {
        let allValid = true;
        let msgErrorAlert = '¡Debes establecer un valor para cada clave requerida!';

        SLTFile.JSONKeys.forEach(({ idClave, Text, KeyType, isRequired }: any) => {
          if (!allValid) return;

          const clave = SLTFile.claves.find(
            (clave: any) => idClave === clave.IDIAVisionTextModelKey
          );

          const validRequired = Boolean(KeyType === 'KMX' || (isRequired && Text) || !isRequired);
          let validFormat = true;

          if (clave && Text) {
            if (clave.KeyFormatValue === 'XFD') {
              if (!parseDate(Text, clave)) {
                validFormat = false;
                msgErrorAlert = `¡${
                  clave.IAVisionTextModelKeyTitle
                }, no tiene un formato válido de fecha! Débe ser ${
                  clave.KeyFormtaDate || 'DD-MM-YYYY'
                }`;
              }
            } else if (clave.KeyFormatValue === 'FND' || clave.KeyFormatValue === 'FNE') {
              if (parseNumber(Text, clave) === false) {
                validFormat = false;
                msgErrorAlert = `¡${
                  clave.IAVisionTextModelKeyTitle
                }, no tiene un formato válido de número! Asegurate de que no contenga letras${
                  clave.KeyFormatValue === 'FND'
                    ? ` y que contenga igual o mas de ${clave.KeyFormatDecimalDoku} decimales`
                    : '.'
                }`;
              }
            }
          }

          if (!validRequired || !validFormat) {
            allValid = false;
          }
        });

        if (allValid) {
          SLTFile.JSONKeys = SLTFile.JSONKeys.map((KeyJson: any) => {
            if (KeyJson.KeyType !== 'KMX') return KeyJson;

            const clave = SLTFile.claves.find(
              ({ IDIAVisionTextModelKey }: any) => KeyJson.idClave === IDIAVisionTextModelKey
            );

            const StdIDKeys = clave.IAVisionModelPartialKeys.split(',').filter((IDKey: any) =>
              Boolean(IDKey)
            );
            const Text = SLTFile.JSONKeys.filter(({ idClave }: any) => StdIDKeys.includes(idClave))
              .map(({ Text }: any) => Text)
              .join(clave.IAVisionModelPartialKeysDiv || ';');

            KeyJson.Text = Text;
            KeyJson.TextOriginal = Text;

            return KeyJson;
          });

          updateFileData(
            fileID,
            {
              processAnalysis: 4,
              JSONKeys: SLTFile.JSONKeys,
            },
            { MDRInfoValSelected: null }
          );
        } else {
          window.EventBus.invokeOnAlertStore('showNotification', msgErrorAlert, 'CPXDoku', 'error');
          return false;
        }
      }
      // El siguiente paso guarda la data
      // tanto de la verificacion como de las keys que se pudieron haber ajustado en el paso 1
      else if (step === 5) {
        const setVerifyValue = (keyJson: any) => {
          keyJson.TextVerify = 1;

          return keyJson;
        };

        SLTFile.JSONKeys = SLTFile.JSONKeys.map(setVerifyValue);
        SLTFile.Doku_TextractBlock = SLTFile.Doku_TextractBlock.map(setVerifyValue);

        updateFileData(
          fileID,
          {
            JSONKeys: SLTFile.JSONKeys,
            statusAIKeys: 'validating',
            Doku_TextractBlock: SLTFile.Doku_TextractBlock,
          },
          {},
          async () => {
            const isSaveSuccesfully = await handleSaveKeysForFile(true, {
              isManual: false,
              wayAnalisys,
            });

            if (isSaveSuccesfully) {
              const isNeccesaryMove = SLTFile.IDDokuGroup !== 'APPXAIXX';

              if (isNeccesaryMove) await handleMoveGroup('APPXAIXX', true);

              const SyncData = await handleSaveDataTextForFile();

              if (SyncData) {
                updateFileData(fileID, {
                  AIFieldsSync: Object.keys(SyncData.FieldsSync),
                  AIItemSync: SyncData.ResultForm,
                  statusAIKeys: 'animation-successfully',
                  fetchedProvider: true,
                  processAnalysis: AIConfig.VisionSincroEditValues !== 'XNA' ? 5 : 2,
                });

                // this.updateFileData(fileID, {
                //   AIFieldsSync: Object.keys(SyncData.FieldsSync),
                //   AIItemSync: SyncData.ResultForm,
                //   statusAIKeys: 'animation-successfully',
                //   fetchedProvider: true,
                // }, {}, () => {
                //   const timerToAnimation = setTimeout(() => {
                //     this.updateFileData(fileID, {
                //       processAnalysis: AIConfig.VisionSincroEditValues !== 'XNA' ? 5 : 2,
                //     });

                //     clearTimeout(timerToAnimation);
                //   }, 2000);
                // });
              } else {
                updateFileData(fileID, {
                  statusAIKeys: 'animation-error',
                  processAnalysis: 2,
                });

                // this.updateFileData(fileID, { statusAIKeys: 'animation-error', }, {}, () => {
                //   const timerToAnimation = setTimeout(() => {
                //     this.updateFileData(fileID, { processAnalysis: 2, });

                //     clearTimeout(timerToAnimation);
                //   }, 2000);
                // });
              }
            }
          }
        );
      }

      return true;
    },

    handleBuildJSONKeys: (clave = {}, { Text } = {}) => ({
      idClave: clave.IDIAVisionTextModelKey,
      refClave: clave.IAVisionTextModelKeyTitle,
      shouldEdit: clave.CHKEnableManual,
      isRequired: clave.CHKEnableMandatory,
      tooltip: clave.IAVisionModelKeyToolTip,
      KeyType: clave.IAVisionModelKeyTipo,
      keysIncluded: clave.IAVisionModelPartialKeys,
      TextVerify: 0,
      HumanInLoop: '0',
      HumanBox: '0',
      HumanText: '0',
      isCheckEdit: false,
      TextOriginal: Text || null,
      BoundingBox: null,
      Confidence: null,
      TrueConfidence: clave.IAVisionConfidencePercent,
      BlockType: null,
      Text: Text || null,
      Id: null,
    }),

    getAIInitialFileConfig: () => {
      const state = get();
      const { props } = state;
      const { isAnalizer } = props;

      if (!isAnalizer) return {};

      const providerAutoSelected = null; // formItem.rowSession.SRCIDBaseField ? copyValue(formItem.rowSession) : null;

      return {
        JSONKeys: [],
        modeler: {},
        claves: [],
        KeysNoEdit: [],

        processAnalysis: providerAutoSelected ? 2 : 0,

        isProviderFromProps: Boolean(providerAutoSelected),
        providerSelected: providerAutoSelected,
        isEditingAI: false,
        isAIModifiedDim: false,
        isFetchedClaves: false,
        statusAIKeys: null,
        fetchedProvider: Boolean(providerAutoSelected),
        fetchAnalysis: 'standby',

        AIFieldsSync: [],
        AIItemSync: null,
        AIItemAnalysis: null,

        typeOfBoundingBox: null,
      };
    },

    handleGoToSelectProvider: () => {
      const state = get();
      const { getSelectedFile, currR, updateFileData } = state;
      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      if (SLTFile.fetchAnalysis === 'loading') {
        // Cancelando solicitud de analisis porque volvió a selección de proveedor
        currR.cancelAllEqual('FetchAnalysis', true);
      }

      updateFileData(fileID, {
        processAnalysis: 0,
        fetchedProvider: false,
        providerSelected: null,
        modeler: {},
        fetchAnalysis: 'standby',
      });
    },

    handleDeleteAI: async (confirmed = false, isDeleteFile = false) => {
      const state = get();
      const {
        getSelectedFile,
        handleMoveGroup,
        handleDeleteFile,
        getAIInitialFileConfig,
        updateFileData,
      } = state;
      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      if (!confirmed) {
        setState({ ModalConfirmAIDelete: true });
      } else {
        if (!isDeleteFile) {
          setState({ ModalConfirmAIDelete: 'msg-file' });
          return;
        } else {
          setState({ ModalConfirmAIDelete: false });
        }

        const { AIConfig } = state;

        let isDeletedAI = false;
        let isDeletedSync = false;

        // Elimina el analisis
        if (SLTFile.AIItemAnalysis) {
          const data = {
            Row: SLTFile.AIItemAnalysis,
            isNuevo: false,
            idfrm: 'Frm0001637194643838933542',
            idSes: `s${new Date().getTime()}`,
          };

          MainLoaderIndicator(true);
          const response = await ApiPostCompressAsync(`${AppConstants().URLForms}DeleteItem`, data);
          MainLoaderIndicator(false);

          if (response.Error) {
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              `¡Error al eliminar el análisis! ${response.Error}`,
              'CPXDoku',
              'error'
            );
          } else {
            if (response.Result === 'true') {
              isDeletedAI = true;
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                '¡Análisis eliminado!',
                'CPXDoku',
                'info'
              );
            } else {
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                '¡No se eliminó el análisis!',
                'CPXDoku',
                'error'
              );
            }
          }
        }

        if (isDeletedAI) {
          MainLoaderIndicator(true);
          const JobUpdate = await ApiPostCompressAsync(`${AppConstants().URLProcesos}ProcessJobs`, {
            IDQueryJob: 'QJ0001637225770599855347',
            row: {
              IDDoku: SLTFile.IDDoku,
              IDIAVisionTextAnalyzer: null,
            },
          });
          MainLoaderIndicator(false);

          if (JobUpdate.Error) {
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              '¡No se eliminó correctamente la referencia del análisis previo con el documento!',
              'CPXDoku',
              'error'
            );
          }
        }

        // Elimina el registro de sincronizacion
        if (isDeletedAI && SLTFile.AIItemSync && AIConfig.VisionTextFormMaster) {
          const data = {
            Row: SLTFile.AIItemSync,
            isNuevo: false,
            idfrm: AIConfig.VisionTextFormMaster,
            idSes: `s${new Date().getTime()}`,
          };

          MainLoaderIndicator(true);
          const response = await ApiPostCompressAsync(`${AppConstants().URLForms}DeleteItem`, data);
          MainLoaderIndicator(false);

          if (response.Error) {
            window.EventBus.invokeOnAlertStore(
              'showNotification',
              `¡Error al eliminar el registro de sincronización! ${response.Error}`,
              'CPXDoku',
              'error'
            );
          } else {
            if (response.Result === 'true') {
              isDeletedSync = true;
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                '¡Sincronización eliminada!',
                'CPXDoku',
                'info'
              );
            } else {
              window.EventBus.invokeOnAlertStore(
                'showNotification',
                '¡No se eliminó el registro de sincronización!',
                'CPXDoku',
                'error'
              );
            }
          }
        }

        // Mueve el documento al grupo de 'Por analizar'
        if (
          isDeletedAI &&
          isDeletedSync &&
          isDeleteFile !== 'yes' &&
          SLTFile.IDDokuGroup !== 'APPXAIX'
        ) {
          await handleMoveGroup('APPXAIX', true);
        }

        if (isDeletedAI && isDeletedSync) {
          if (isDeleteFile === 'yes') {
            handleDeleteFile(true);
          } else {
            const objToUpdate = getAIInitialFileConfig();

            updateFileData(fileID, objToUpdate, {});
          }
        }
      }
    },

    handleEditAI: async () => {
      const state = get();
      const { getSelectedFile, updateFileData, getAIInitialFileConfig, handleFetchAnalysis } =
        state;
      const fileID = state.fileID;
      const SLTFile = getSelectedFile();
      if (!SLTFile) return;

      const { AIConfig } = state;

      MainLoaderIndicator(true, 'CPXDoku');
      let KeysNoEdit = await ApiPostCompressAsync(`${AppConstants().URLForms}GetKeysForm`, {
        idfrm: AIConfig.VisionTextFormMaster,
      });
      MainLoaderIndicator(false, 'CPXDoku');

      if (KeysNoEdit.Error) {
        console.log('Ocurrio un error al invocar el metodo GetKeysForm: ', KeysNoEdit.Error);
        window.EventBus.invokeOnAlertStore(
          'showNotification',
          '¡No se puede editar el análisis, ocurrió un error al obtener la lista de campos del formulario!',
          'CPXDoku',
          'error'
        );
        return;
      }

      KeysNoEdit = JSON.parse(KeysNoEdit.Result);

      if (KeysNoEdit && Array.isArray(KeysNoEdit)) {
        KeysNoEdit = KeysNoEdit.filter(({ isFilterNew }) => Boolean(isFilterNew)).map(
          ({ field }) => field
        );
      } else {
        KeysNoEdit = [];
      }

      updateFileData(
        fileID,
        {
          ...getAIInitialFileConfig(),
          KeysNoEdit,
          providerSelected: SLTFile.providerSelected,
          fetchedProvider: Boolean(SLTFile.providerSelected),
          isEditingAI: true,
          processAnalysis: 2,
        },
        {},
        handleFetchAnalysis
      );
    },

    /* ANALYSYS FUNCTIONS - END */

    searchRecords: (allFiles = [], extraConfig = {}) => {
      // const { isAnalizer } = this.props;
      const state = get();
      const { filterItems, selectedTab, groups, hiddenSubGroups, mediaGroups, docGroups } = state;

      allFiles = allFiles.filter((file) => {
        if (hiddenSubGroups.includes(file.IDDokuSubGroup)) {
          return false;
        }

        if (selectedTab === 'media' && mediaGroups.includes(file.IDDokuClase)) {
          return true;
        } else if (selectedTab === 'docs' && docGroups.includes(file.IDDokuClase)) {
          return true;
        } else {
          return false;
        }
      });

      let coincidence = filterItems.length
        ? allFiles.filter((file) => {
            const ref = noDiacritical(parseLowerCase(file.Doku_Ref));
            const minus1 = noDiacritical(parseLowerCase(filterItems));

            // let keysX = [];

            // if (isAnalizer && file.JSONKeys && Array.isArray(file.JSONKeys)) {
            //   keysX = file.JSONKeys.filter(({ Text }) => Boolean(Text)).map(({ Text }) => Text);
            // }

            return ref.includes(minus1); //  || subIncludes(ref, keysX)
          })
        : allFiles;

      if (!extraConfig.noGroup) {
        coincidence = coincidence.sort((a, b) => {
          const refGroup1 = groups.find(
            ({ IDDokuSubGroup }) => a.IDDokuSubGroup === IDDokuSubGroup
          );
          const refGroup2 = groups.find(
            ({ IDDokuSubGroup }) => b.IDDokuSubGroup === IDDokuSubGroup
          );

          if (refGroup1 && refGroup2) {
            const title1 = `${refGroup1.DokuGroupRef}: ${refGroup1.DokuSubGroupRef} ${a.Doku_Ref}`;
            const title2 = `${refGroup2.DokuGroupRef}: ${refGroup2.DokuSubGroupRef} ${b.Doku_Ref}`;

            if (title1.toLowerCase() > title2.toLowerCase()) return 1;
            if (title1.toLowerCase() < title2.toLowerCase()) return -1;
          }

          return 0;
        });

        return groupBy(coincidence, 'IDDokuSubGroup');
      } else {
        return coincidence;
      }
    },

    getFilesToRender: () => {
      const state = get();
      const {
        files: allFiles,
        isLoadingGroups,
        MaxItemsInPage,
        NumPagView,
        ComJumps,
        searchRecords,
      } = state;

      if (isLoadingGroups) return allFiles;

      const files = searchRecords(allFiles);

      if (allFiles.length <= MaxItemsInPage) {
        return files;
      }

      const keysRecords = Object.keys(files);
      const finalRenderRecords: any = {};

      const startFrom = (NumPagView - 1) * ComJumps;

      let maxItems = ComJumps;
      let passedsElements = 0;

      for (let i = 0; i < keysRecords.length; i++) {
        const groupRecords = files[keysRecords[i]];

        if (startFrom > passedsElements) {
          if (groupRecords.length > startFrom) {
            passedsElements = startFrom;
            finalRenderRecords[keysRecords[i]] = groupRecords.slice(
              startFrom,
              startFrom + maxItems
            );
            maxItems -= finalRenderRecords[keysRecords[i]].length;
            if (maxItems <= 0) break;
          } else if (passedsElements + groupRecords.length > startFrom) {
            const init = startFrom - passedsElements;
            passedsElements = startFrom;
            finalRenderRecords[keysRecords[i]] = groupRecords.slice(init, init + maxItems);
            maxItems -= finalRenderRecords[keysRecords[i]].length;
            if (maxItems <= 0) break;
          } else {
            passedsElements += groupRecords.length;
          }
        } else {
          if (groupRecords.length > maxItems) {
            finalRenderRecords[keysRecords[i]] = groupRecords.slice(0, maxItems);
            maxItems = 0;
            break;
          } else {
            finalRenderRecords[keysRecords[i]] = groupRecords;
            maxItems -= groupRecords.length;
          }
        }
      }

      return finalRenderRecords;
    },

    handleOpenTemplate: () => {
      ItemClick(
        'COREDesignWrapper?IDD=XTX',
        { IDFrmDesing: get().designID },
        FormActions,
        {},
        'CPXDoku',
        get().handleClickReload
      );
    },

    openEditDokuForm: () => {
      // const entidad = Object.assign({}, { CPXTabFrameAutoRedirectTab: 1, }, this.state.formItem.rowSession);
      const state = get();
      const entidad = { IDObjCode: state.formItem.rowSession.IDObjCode };

      // 'TABFrame?IDF=TXXPX00005'
      ItemClick(
        'FormEditView?IDF=Frm0001635493085516110762&from=onlyedit',
        entidad,
        FormActions,
        {},
        'Doku',
        get().handleClickReload
      );
    },

    CtrlContentScrollTo: (to) => {
      if (get().scrollContent && typeof get().scrollContent.scrollTo === 'function') {
        get().scrollContent.scrollTo(to);
      }
    },

    handleChangePagination: (value) => {
      setState({ NumPagView: value });
      // get().forceUpdate();
      get().CtrlContentScrollTo();
    },

    handleChangeUploadGroup: (group) => () => {
      const state = get();
      const copyGroup = copyValue(group);

      copyGroup.subGroupExternalUrl =
        state.groups.find(
          ({ IDDokuTipo, IDDokuGroup }: any) =>
            IDDokuTipo === 'DKTMED' && IDDokuGroup === copyGroup.IDDokuGroup
        )?.IDDokuSubGroup || null;

      setState({ selectedGroup: copyGroup });
    },

    handleChangeUploadUrl: (_, value) => {
      setState({ uploadUrl: { value, error: '' } });
    },

    handleUploadFileFromUrl: async () => {
      const state = get();
      const { props, uploadUrl, DKConfig, currR, user, getAIInitialFileConfig } = state;
      const { formItem } = props;
      const validHosts = ['www.youtube.com'];

      if (uploadUrl.isLoading) return;

      const showError = (error: any) => {
        setState((prevState) => ({
          uploadUrl: {
            ...prevState.uploadUrl,
            error,
          },
        }));
      };

      try {
        const urlObj = new URL(uploadUrl.value || '');

        if (!validHosts.includes(urlObj?.hostname)) {
          return showError(
            `Solo se Permiten URL de los Siguientes Dominios: ${validHosts.join(',')}`
          );
        }

        if (
          urlObj?.hostname === 'www.youtube.com' &&
          (urlObj?.pathname !== '/watch' || !GetParameterFromQuerystring(uploadUrl.value, 'v'))
        ) {
          return showError('No es una URL válida de YouTube');
        }
      } catch (error: any) {
        if (error.name === 'TypeError') {
          return showError('La URL Ingresada no es Válida');
        }

        return console.log('Ocurrio un error al validar la URL: ', error);
      }

      setState((prevState) => ({
        uploadUrl: {
          ...prevState.uploadUrl,
          isLoading: true,
        },
      }));
      console.log('Se procede a subir el archivo con la Url ingresada');

      const { id: keySource, source } = currR.add();

      const response: any = await ApiPostAsync(
        '@Vulture uploadVideoURL',
        {
          IDObjID: formItem.rowSession.SRCIDBaseField,
          IDObjCode: formItem.rowSession.SRCIDObjCode,
          IDLoginUser: user.IDLoginUser,
          IDAPIDataCloudProvider: DKConfig.IDAPIDataCloudConexion,
          IDCpanaxID: user.IDCpanaxID,
          IDDokuGroup: state.selectedGroup.IDDokuGroup,
          IDDokuSubGroup: state.selectedGroup.subGroupExternalUrl,
          URL: uploadUrl.value,
          IDDokuClase: 'DKCXYTB',
          Doku_Ref: `DOKU External ${new Date().getTime()}`,
        },
        source
      );

      console.log(response);

      if (response.error === currR.cancellationMessage) return;

      currR.remove(keySource);

      if (response.error) {
        console.log('Ocurrio un error al intentar subir el archivo con url: ', response.error);
        setState((prevState) => ({
          uploadUrl: {
            ...prevState.uploadUrl,
            isLoading: false,
          },
        }));
        return window.EventBus.invokeOnAlertStore(
          'showNotification',
          '¡Ocurrió un Error! No se pudo subir el Archivo',
          'CPXDoku',
          'error'
        );
      }

      window.EventBus.invokeOnAlertStore(
        'showNotification',
        'Archivo subido correctamente',
        'CPXDoku'
      );

      const FileToAdd = {
        ...response.result.Item,
        ...getAIInitialFileConfig(),
      };

      setState((prevState) => {
        return {
          files: [...prevState.files, FileToAdd],
          uploadUrl: {
            ...prevState.uploadUrl,
            value: '',
            isLoading: false,
          },
        };
      });
    },

    selectedTabAction: (selectedTab) => {
      const state = get();
      const { DKConfig } = state;
      if (selectedTab === 'docs') {
        const MaxItemsInPage = 100;
        setState({
          MaxItemsInPage,
          ComJumps:
            DKConfig.DokuViewMaxFileDoc && DKConfig.DokuViewMaxFileDoc <= MaxItemsInPage
              ? DKConfig.DokuViewMaxFileDoc
              : 10,
        });
      } else if (selectedTab === 'media') {
        const MaxItemsInPage = 50;
        setState({
          MaxItemsInPage,
          ComJumps:
            DKConfig.DokuViewMaxFile && DKConfig.DokuViewMaxFile <= MaxItemsInPage
              ? DKConfig.DokuViewMaxFile
              : 10,
        });
      }
    },

    renderDokuWTemplate: () => {
      const state = get();
      const {
        props,
        files,
        groups,
        fileID,
        formItem,
        DKConfig,
        template,
        ModalDoku,
        selectedTab,
        tempInfoDoku,
        selectedFiles,
        selectedGroup,
        PopperUseAs,
        ModalMoveGroup,
        isLoadingGroups,
        listUploadFiles,
        avatarUpdateNumber,
        ModalEditFile,
        ModalConfirmDelete,
        ModalConfirmAIDelete,
        DokuTempsItemsForProp,
        DokuTempsItemsForTab,
        MaxItemsInPage,
        groupsInfo,
        protectedGroups,
        protectedSubGroups,
        showClose,
        scrollContent,
        isMobile,
        ComJumps,
        NumPagView,
        tempInfo,
        dropzone,
        user,
        openPanelUpload,
        handleClose,
        getSelectedFile,
        getFilesToRender,
        searchRecords,
        isUploadingFile,
        handleInputSearch,
        handleKeyPressSearch,
        handleClickReload,
        handleBulkES,
        handleChangeTab,
        handleUseAs,
        handleDeleteFile,
        handleClickContent,
        handleSelectAllGroup,
        handleSelectFile,
        handleClickFileItem,
        updateDokuAvatars,
        handleChangePagination,
        handleClosePanel,
        handleChangeCompress,
        handleChangeUploadUrl,
        handleUploadFileFromUrl,
        handleChangeUploadGroup,
        handleDeleleListUploadFile,
        getAIInitialFileConfig,
        handleChangeKeyValue,
        handleChangeKeyForBox,
        handleChangeStepAnalizer,
        handleClickBox,
        handleCloseMdlFile,
        handleCompressFile,
        handleConfigKey,
        handleConvertFile,
        handleDeleteAI,
        handleEditAI,
        handleEditFileName,
        handleFetchAnalysis,
        handleGoToSelectProvider,
        handleMoveGroup,
        handleSaveKeysForFile,
        updateFileData,
        openEditDokuForm,
        handleOpenTemplate,
      } = state;
      const { isAnalizer } = props;

      const SLTFile = getSelectedFile();

      const templateItemsForProp = DokuTempsItemsForProp[template];
      const templateItemsForTab = DokuTempsItemsForTab[selectedTab];

      const subGroups = getFilesToRender();
      const keysGroups = Object.keys(subGroups);

      const NumRecordsFiltered = !isLoadingGroups
        ? searchRecords(files, { noGroup: true }).length
        : 0;
      const existPagination = NumRecordsFiltered > MaxItemsInPage;

      const defPropsDialogs = {
        file: SLTFile,
        isAnalizer: Boolean(isAnalizer),
        rowSession: formItem.rowSession,
        groupsInfo,
        protectedGroups,
        protectedSubGroups,
      };

      const isSomeFileSelected = selectedFiles.length > 0;
      const isSomeFileUploading = isUploadingFile();

      const XJsonTemp = Object.assign({}, (tempInfoDoku && tempInfoDoku.FieldExtendedJson) || {}, {
        BackgroundImage: (DKConfig && DKConfig.DokuViewBackgroundImage) || '',
      });

      const commonSSearchProps = {
        onInputSearch: handleInputSearch,
        onInputKeyPress: handleKeyPressSearch,
        valueInputSearch: state.filterItems,
        extraSearchProps: {
          entity: tempInfoDoku.FrmDSmartSearch,
          autoFocus:
            !props.CPXTABViewConfig ||
            (!!props.CPXTABViewConfig.isInTabActive &&
              !!props.CPXTABViewConfig.isInTabActiveParent),
        },
      };

      const isVisibleGuide =
        tempInfoDoku.FrmDPin.PINPosition === 'in-mlinks' && DKConfig.CHKQuickGuide;

      return (
        <WDoku
          XJson={XJsonTemp}
          className={`CPXDoku ${templateItemsForProp} ${templateItemsForTab} CPXApp-Common-ControlDevelopWrapper`}
          rowSession={formItem.rowSession}
          sections={tempInfoDoku.OrdenSections}
        >
          {(section: any) => {
            let commonLinksProps = {};

            if (['speeddial', 'actionlinks'].includes(section.control)) {
              commonLinksProps = {
                onClose: handleClose,
                hasClose: showClose,

                hasReload: true,
                onReload: handleClickReload,

                TitleNew: 'Subir Archivo',
                hasNew: groupsInfo.length > 0 && selectedTab !== 'avatar',
                onNew: openPanelUpload,
                buttons: [
                  {
                    icon: 'mdi mdi-cloud',
                    title: 'Bulk de Insercion a ES',
                    onClick: handleBulkES,
                  },
                  ...(isVisibleGuide ? [props.getInfoBtn(tempInfoDoku.FrmDPin)] : []),
                ],

                entity: tempInfoDoku.FrmDActionLinks,
              };
            }

            if (section.control === 'background') {
              return <DTempBackground entity={XJsonTemp} rowSession={formItem.rowSession} />;
            } else if (section.control === 'closeaction') {
              return (
                <DTempCloseAction
                  entity={tempInfoDoku.FrmDClose}
                  hasClose={showClose}
                  isModal={!!props.CPXPIsOpenInModal}
                  onClose={handleClose}
                />
              );
            } else if (section.control === 'actionlinks') {
              return (
                <DTempActionLinks
                  XJson={XJsonTemp}
                  closeActionEntity={tempInfoDoku.FrmDClose}
                  isModal={!!props.CPXPIsOpenInModal}
                  {...commonLinksProps}
                  {...commonSSearchProps}
                />
              );
            } else if (section.control === 'smartsearch') {
              // @ts-expect-error component-in-js
              return <DTempSmartSearch {...commonSSearchProps} />;
            } else if (section.control === 'avatar') {
              return (
                <DTempAvatar
                  entity={{
                    ...tempInfoDoku.FrmDAvatar,
                    Icono: DKConfig.DokuViewIcon || tempInfoDoku.FrmDAvatar.Icono,
                  }}
                  rowSession={
                    avatarUpdateNumber > 0
                      ? { SRCIDBaseField: formItem.rowSession.SRCIDBaseField }
                      : formItem.rowSession
                  }
                  updateNumber={avatarUpdateNumber}
                />
              );
            } else if (section.control === 'header') {
              return (
                <DTempHeader
                  entity={{
                    ...tempInfoDoku.FrmDHeader,
                    Titulo: DKConfig.DokuViewTitle,
                    SubTitulo: '',
                  }}
                  rowSession={formItem.rowSession}
                />
              );
            } else if (section.control === 'content') {
              return (
                <DTempContent entity={tempInfoDoku.FrmDContent}>
                  <div className="CPXDoku-Content">
                    {!isAnalizer && (
                      <WrapperTabs
                        // @ts-expect-error component-in-js
                        backColor={tempInfoDoku ? tempInfoDoku.FrmDContent.TabBackUnSelect : ''}
                        backColorSelected={
                          tempInfoDoku ? tempInfoDoku.FrmDContent.TabBackSelect : ''
                        }
                      >
                        <BarNav
                          tabs={[
                            {
                              id: 'media',
                              title: 'Media',
                              onClick: handleChangeTab,
                              active: selectedTab === 'media',
                            },
                            {
                              id: 'docs',
                              title: 'Documentos',
                              onClick: handleChangeTab,
                              active: selectedTab === 'docs',
                            },
                            {
                              id: 'avatar',
                              title: 'Avatar',
                              onClick: handleChangeTab,
                              active: selectedTab === 'avatar',
                            },
                          ]}
                          template="simple"
                        />
                      </WrapperTabs>
                    )}

                    {isSomeFileSelected && (
                      <Fade in>
                        <WrapperFilesOptions>
                          <ToolsFilesText>
                            <span>
                              {selectedFiles.length} Seleccionado
                              {selectedFiles.length > 1 ? 's' : ''}
                            </span>
                          </ToolsFilesText>

                          <ToolsFilesButtons>
                            {selectedFiles.length === 1 &&
                              isImageDoku(getSelectedFile(selectedFiles[0])?.IDDokuClase) && (
                                <IconButton onClick={handleUseAs}>
                                  <GenericIcon icon="mdi mdi-image-area" />
                                </IconButton>
                              )}

                            <IconButton onClick={() => handleDeleteFile()}>
                              <GenericIcon icon="ms-Icon ms-Icon--Delete" />
                            </IconButton>
                          </ToolsFilesButtons>
                        </WrapperFilesOptions>
                      </Fade>
                    )}

                    {isLoadingGroups && (
                      <div className="CPXApp-Common-Centered-Element">
                        <CircularProgress color="secondary" />
                      </div>
                    )}

                    {!isLoadingGroups && (
                      // @ts-expect-error component-in-js
                      <ScrollContainer
                        ref={scrollContent}
                        propsToSet={{ onClick: handleClickContent }}
                        style={{ flex: 1, height: 'auto' }}
                      >
                        {selectedTab !== 'avatar' &&
                          (keysGroups.length > 0 ? (
                            keysGroups.map((keyGroup, index) => {
                              const group = groups.find(
                                ({ IDDokuSubGroup }) => IDDokuSubGroup === keyGroup
                              );

                              if (!group) return null;

                              const filesGroup = subGroups[group.IDDokuSubGroup];

                              if (filesGroup.length) {
                                return (
                                  <div
                                    key={group.IDDokuSubGroup}
                                    className="CPXDoku-Content-Group"
                                    style={{
                                      marginBottom:
                                        index === keysGroups.length - 1
                                          ? !isMobile
                                            ? '70px'
                                            : '78px'
                                          : '',
                                    }}
                                  >
                                    <div
                                      className="CPXDoku-Content-Group-Header"
                                      onClick={handleSelectAllGroup(group)}
                                    >
                                      <span className="CPXDoku-Content-Group-Header-Ref">
                                        {group.DokuGroupRef}:{' '}
                                      </span>
                                      <span>{group.DokuSubGroupRef}</span>
                                    </div>
                                    <div className="CPXDoku-Content-Group-Items">
                                      {filesGroup.map((file: any) => {
                                        const type = file.IDDokuClase;
                                        const URL = getAbsoluteOrAddPrefixToUrl(file.Doku_UrlUbi);
                                        const thumbnail =
                                          file.Doku_UrlThumb &&
                                          file.Doku_UrlThumb.startsWith('https')
                                            ? file.Doku_UrlThumb
                                            : '';

                                        return (
                                          <CPXSimpleTooltip
                                            key={file.IDDoku}
                                            title={isAnalizer ? 'Click para analizar' : ''}
                                          >
                                            <div
                                              className={`CPXDoku-Content-Group-Items-Item${
                                                selectedFiles.includes(file.IDDoku)
                                                  ? ' CPXDoku-Item-Selected'
                                                  : ''
                                              }`}
                                              style={{
                                                width: DKConfig.DokuViewColumns
                                                  ? `calc(${DKConfig.DokuViewColumns} - 10px)`
                                                  : '',
                                                border:
                                                  isAnalizer &&
                                                  file.modeler &&
                                                  file.modeler.IDDoku === file.IDDoku
                                                    ? '2px solid var(--OverColor)'
                                                    : '',
                                              }}
                                              onClick={handleSelectFile(file)}
                                              onDoubleClick={handleClickFileItem(file)}
                                            >
                                              {templateItemsForTab === 'CPXDoku-W-Avatar' && (
                                                // @ts-expect-error component-in-js
                                                <Avatar
                                                  iconAvatar={dokuInfo(URL).icon}
                                                  settings={{
                                                    direction: 'row',
                                                    size: '2.85rem',
                                                    theme: 'dark',
                                                  }}
                                                />
                                              )}

                                              {templateItemsForTab === 'CPXDoku-W-Thumb' && (
                                                <PreviewImageCard
                                                  icon={
                                                    !isImageDoku(type) ? dokuInfo(URL).icon : ''
                                                  }
                                                  src={isImageDoku(type) ? URL : ''}
                                                  thumb={isImageDoku(type) ? thumbnail : ''}
                                                />
                                              )}

                                              <div className="CPXDoku-Content-Group-Items-Item-Info">
                                                <div className="CPXDoku-Content-Group-Items-Item-Info-Name">
                                                  {file.Doku_Ref}
                                                </div>
                                                <div className="CPXDoku-Content-Group-Items-Item-Info-WExtra">
                                                  <div className="CPXDoku-Content-Group-Items-Item-Info-Date">
                                                    {file.Doku_DateUpload}
                                                  </div>
                                                  {!file.CHKExternalURL && (
                                                    <div className="CPXDoku-Content-Group-Items-Item-Info-Size">
                                                      {formatBytes(file.Doku_FileSize, 0)}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </CPXSimpleTooltip>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              } else {
                                return null;
                              }
                            })
                          ) : (
                            <div className="CPXApp-Common-Centered-Element CPXDoku-Tab-NoData">
                              <i
                                className="mdi mdi-cloud-outline-off"
                                style={{ fontSize: '5rem' }}
                              />
                              <span style={{ fontSize: '18px', fontWeight: '400' }}>No Data</span>
                            </div>
                          ))}

                        <WrapperAvatarUpload
                          style={{
                            display: selectedTab === 'avatar' ? '' : 'none',
                          }}
                        >
                          <CPXAvatarUpload
                            {...props}
                            hideClose
                            fileAvatar={
                              files.find(
                                ({ IDDokuSubGroup }) => IDDokuSubGroup === 'APPDKGAVSIMX'
                              ) || {}
                            }
                            fileBack={
                              files.find(
                                ({ IDDokuSubGroup }) => IDDokuSubGroup === 'APPDKGAVSIMZ'
                              ) || {}
                            }
                            rowSession={props.formItem.rowSession}
                            style={{ background: 'transparent' }}
                            onModified={updateDokuAvatars}
                          />
                        </WrapperAvatarUpload>
                      </ScrollContainer>
                    )}

                    {!isLoadingGroups && existPagination && (
                      <CPXPagination
                        config={tempInfoDoku.FrmDDoku || {}}
                        count={NumRecordsFiltered}
                        jumps={ComJumps}
                        loaderProps={{
                          from: 'Doku',
                          entity: tempInfoDoku.FrmDContent,
                          prefix: 'Pag',
                        }}
                        page={NumPagView}
                        totalCount={files.length}
                        onChange={handleChangePagination}
                      />
                    )}
                  </div>
                </DTempContent>
              );
            } else if (section.control === 'pin' && DKConfig.CHKQuickGuide) {
              const btnInfo = props.getInfoBtn();
              return (
                <DTempPin
                  entity={tempInfoDoku.FrmDPin}
                  isActive={btnInfo.active}
                  tooltipProps={{
                    rowSession: props.formItem.rowSession,
                    ...btnInfo.titleHtml,
                  }}
                  onClick={btnInfo.onClick}
                />
              );
            } else if (section.control === 'speeddial') {
              return <DTempFABLinks {...commonLinksProps} />;
            }
          }}

          <div
            className={`CPXDoku-Panel CPXDoku-Panel-Upload${
              ModalDoku === 'PUpload' ? ' Visible' : ''
            }`}
          >
            <HeaderStandard
              expandedMode
              hideButtonBack
              hideClose
              hideReload
              hideSearch
              SubTitle={selectedGroup ? selectedGroup.DokuGroupRef : ''}
              // middleBtns={[{
              //   id: "PlusOpt",
              //   icon: "mdi mdi-send",
              //   title: "Enviar",
              //   onClick: this.handleInitUpload,
              //   isVisible: listUploadFiles.length > 0,
              // }]}
              Title="Subir Archivo"
              extraButtons={[
                {
                  icon: 'mdi mdi-arrow-left',
                  tooltip: 'Cambiar Grupo',
                  isDisabled: state.uploadUrl.isLoading || isSomeFileUploading,
                  onClick: () => {
                    setState({ selectedGroup: null });
                  },
                  isVisible:
                    selectedGroup &&
                    listUploadFiles.length === 0 &&
                    groupsInfo.length > 1 &&
                    !isAnalizer,
                },
                {
                  icon: 'mdi mdi-minus',
                  title: 'Minimizar',
                  onClick: handleClosePanel,
                },
              ]}
              iconAvatar="mdi-cloud-upload"
              styleHeader={{ backgroundColor: 'transparent' }}
            />

            {selectedGroup && (
              <>
                <div className="CPXDoku-Panel-CheckCompress">
                  <CPXCheckBox
                    isVisible
                    Config={{ positionLabelCheckBox: 'end' }}
                    id="enableCompress"
                    isChecked={state.enableCompress}
                    isDisabled={isSomeFileUploading}
                    nombreMostrar="Habilitar Comprensión"
                    onValueChange={handleChangeCompress}
                  />

                  <CPXCheckBox
                    isVisible
                    Config={{ positionLabelCheckBox: 'end' }}
                    id="formatConvert"
                    isChecked={state.formatConvert}
                    isDisabled={isSomeFileUploading}
                    nombreMostrar="Convertir a WebP"
                    onValueChange={handleChangeCompress}
                  />
                </div>
                {selectedGroup?.subGroupExternalUrl && (
                  <div className="CPXDoku-Panel-UrlUpload">
                    {
                      // @ts-expect-error component-in-js
                      <CPXTextField
                        Ancho={400}
                        FieldConfig={tempInfo.FrmDFormViewFieldsParsed.restFieldsConfig}
                        alingControl="Right"
                        errorMessage={state.uploadUrl.error}
                        formStyleLabel="Normal"
                        id="CPXDokuUploadUrl"
                        isDisabled={state.uploadUrl.isLoading}
                        isVisible={true}
                        lblW={2}
                        nombreMostrar="URL del Video"
                        value={state.uploadUrl.value}
                        onValueChange={handleChangeUploadUrl}
                      />
                    }
                    {state.uploadUrl.value && !state.uploadUrl.isLoading && (
                      <Fab
                        className="CPXDoku-Modal-SendUploadUrl"
                        color="primary"
                        size="small"
                        onClick={handleUploadFileFromUrl}
                      >
                        <i className="mdi mdi-send" />
                      </Fab>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="CPXDoku-Panel-Content">
              <div
                className={`CPXDoku-Panel-Upload-Selection-Group${
                  !selectedGroup ? ' Visible' : ''
                }`}
              >
                <div className="CPXDoku-Panel-Upload-Selection-Group-Title">
                  Selecciona el Grupo a usar para subir los archivos.
                </div>

                {groupsInfo.map((group) => (
                  <Fab
                    key={group.IDDokuGroup}
                    className="CPXDoku-Modal-Edit-Button"
                    color="primary"
                    size="medium"
                    variant="extended"
                    onClick={handleChangeUploadGroup(group)}
                  >
                    {group.DokuGroupRef}
                  </Fab>
                ))}
              </div>

              <div
                ref={dropzone}
                className={`CPXDoku-DropZone-Container${selectedGroup ? ' Visible' : ''}`}
              >
                <div
                  className="dz-message CPXDoku-Panel-Upload-Initial"
                  style={{
                    // @ts-expect-error component-in-js
                    '--dimensions': listUploadFiles.length ? '200px' : '98%',
                  }}
                >
                  <i className="mdi mdi-cloud-circle" />
                  <span>Arrastra un archivo, o haz click y selecciona uno</span>
                </div>

                {listUploadFiles.length > 0 && (
                  <div className="CPXDoku-Panel-Upload-Files">
                    <div className="CPXDoku-Panel-Upload-Files-Header">
                      <span className="CPXDoku-Panel-Upload-Files-Header-NumFiles">
                        <b>Archivos:&nbsp;</b>
                        {listUploadFiles.length}
                      </span>
                      <span className="CPXDoku-Panel-Upload-Files-Header-TotalSize">
                        <b>Tamaño:&nbsp;</b>
                        {formatBytes(
                          listUploadFiles.reduce(
                            (prevValue, currValue) => currValue.size + prevValue,
                            0
                          ),
                          1
                        )}
                      </span>
                    </div>

                    {listUploadFiles.map((file) => {
                      const XInfoFile = dokuInfo(file.name);
                      const urlImage = isImageDoku(XInfoFile.dokuExt) ? file.url : '';

                      return (
                        <div key={file.id} className="CPXDoku-Panel-Upload-File">
                          {
                            // @ts-expect-error component-in-js
                            <Avatar
                              iconAvatar={XInfoFile.icon}
                              settings={{
                                direction: 'row',
                                size: '8rem',
                                theme: 'dark',
                              }}
                              url={urlImage}
                            />
                          }

                          <div className="CPXDoku-Panel-Upload-File-Info">
                            <div className="CPXDoku-Panel-Upload-File-Info-Title">{file.name}</div>
                            <div className="CPXDoku-Panel-Upload-File-Info-SubTitle">
                              {formatBytes(file.size, 1)}
                            </div>
                          </div>

                          {file.uploading && (
                            <div className="CPXDoku-Panel-Upload-File-Progress">
                              <CircularProgressbar
                                // @ts-expect-error component-in-js
                                initialAnimation
                                styles={buildStyles({
                                  textSize: '24px',
                                  textColor: 'rgba(0,0,0,.87)',
                                  pathColor: 'var(--OverColor)',
                                  trailColor: '#ccc',
                                })}
                                text={`${Math.floor(file.progress)}%`}
                                value={file.progress}
                              />
                            </div>
                          )}

                          {file.processing && (
                            <div className="CPXDoku-Panel-Upload-File-Processing">
                              <CircularProgress color="secondary" />
                            </div>
                          )}

                          {file.sended && (
                            <div className="CPXDoku-Panel-Upload-File-Sended">
                              <i className="mdi mdi-check" />
                              <span>Guardado Correntamente</span>
                            </div>
                          )}

                          {file.error && (
                            <div className="CPXDoku-Panel-Upload-File-Error">
                              <i className="mdi mdi-close" />
                              <span>{file.errorMessage || 'Ocurrió un error'}</span>
                            </div>
                          )}

                          {!file.processing && !file.sended && (
                            <i
                              className="CPXDoku-Panel-Upload-File-Delete mdi mdi-close"
                              onClick={() => handleDeleleListUploadFile(file)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {Boolean(fileID) && (
            <FileViewer
              AIConfig={state.AIConfig}
              MDRInfoValSelected={state.MDRInfoValSelected}
              getAIInitialFileConfig={getAIInitialFileConfig}
              tempInfoFormKeys={state.tempInfoFormKeys}
              onChangeKey={handleChangeKeyValue}
              onChangeOfKey={handleChangeKeyForBox}
              onChangeStep={handleChangeStepAnalizer}
              onClickBox={handleClickBox}
              // onClickVerify={this.handleClickVerify}
              onClose={handleCloseMdlFile}
              onCompress={handleCompressFile}
              onConfigKey={handleConfigKey}
              onConvert={handleConvertFile}
              onDelete={handleDeleteFile}
              onDeleteAI={handleDeleteAI}
              onEditAI={handleEditAI}
              onEditName={handleEditFileName}
              onFetchAnalysis={handleFetchAnalysis}
              onGoToSelectProvider={handleGoToSelectProvider}
              onMove={handleMoveGroup}
              onSaveAI={handleSaveKeysForFile}
              onUpdateFile={updateFileData}
              onUseAs={handleUseAs}
              {...defPropsDialogs}
            />
          )}

          {ModalConfirmAIDelete && (
            <ConfirmModal
              open
              handleAccept={() => {
                if (ModalConfirmAIDelete === 'msg-file') {
                  handleDeleteAI(true, 'yes');
                } else {
                  handleDeleteAI(true, false);
                }
              }}
              handleCancel={() => {
                if (ModalConfirmAIDelete === 'msg-file') {
                  handleDeleteAI(true, 'no');
                }
              }}
              handleClose={() => setState({ ModalConfirmAIDelete: false })}
              textAccept={ModalConfirmAIDelete === 'msg-file' ? 'Si, Eliminar' : 'Eliminar'}
              textCancel={ModalConfirmAIDelete === 'msg-file' ? 'No, Mantener' : 'Cancelar'}
              title={
                ModalConfirmAIDelete === 'msg-file'
                  ? `¿Deseas eliminar el archivo '${SLTFile.Doku_Ref}' también?`
                  : '¿Estás seguro de que deseas eliminar el análisis y la sincronización de éste documento?'
              }
            />
          )}

          {ModalConfirmDelete && (
            <ConfirmModal
              open
              handleAccept={() => handleDeleteFile(true)}
              handleClose={() => setState({ ModalConfirmDelete: false })}
              textAccept="Confirmar"
              title={
                isSomeFileSelected && (selectedFiles.length > 1 || !SLTFile)
                  ? `Se eliminará ${selectedFiles.length} archivos seleccionados. Por favor confirmar`
                  : `Se eliminará el archivo '${SLTFile.Doku_Ref}'. Por favor confirmar`
              }
            />
          )}

          {ModalEditFile && (
            <EditFile
              file={SLTFile}
              onClose={() => setState({ ModalEditFile: false })}
              onSave={handleEditFileName}
            />
          )}

          {ModalMoveGroup && (
            <MoveGroupModal
              file={SLTFile}
              groups={groupsInfo}
              handleAccept={handleMoveGroup}
              onClose={() => setState({ ModalMoveGroup: false })}
            />
          )}

          {PopperUseAs && (
            <UseAsPopper
              handleAccept={handleUseAs}
              popperOptions={PopperUseAs}
              onClose={() => setState({ PopperUseAs: null })}
            />
          )}

          {ModalDoku && <div className="CPXDoku-Panel-Shadow" onClick={handleClosePanel} />}

          <CPXDevButtons
            buttons={props.xdevelopButtons}
            ctrlUrl={props.formItem.URL || props.formItem.lnk}
            environment={props.environmentPreview}
            hasConfig={true}
            hasTemp={true}
            isDev={user.IsCPXDev}
            prefix="XDK"
            // @ts-expect-error component-in-js
            onConfig={openEditDokuForm}
            // @ts-expect-error component-in-js
            onTemp={handleOpenTemplate}
          />
        </WDoku>
      );
    },
  }));
};
