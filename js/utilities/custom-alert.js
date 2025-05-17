import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';
import {swalPositions, swalTypes} from "/js/utilities/constants.js";

const defaultPopupClass = 'blackbackground';
const defaultTextClass = 'white';

export function showAlert({
                              title = 'Error!',
                              text = '',
                              html = '',
                              icon = swalTypes.error,
                              confirmText = 'OK',
                              cancelText = 'Cancel',
                              showCancel = false,
                              timer = 3500,
                              footer = '',
                              backdrop = true,
                              customClass = {},
                              position = swalPositions.center,
                              reverseButtons = true,
                              confirmButtonColor,
                              cancelButtonColor
                          } = {}) {
    const themeMap = {
        [swalTypes.success]: {
            confirmColor: 'var(--night-view-green)',
            titleClass: 'nvgreen',
            footerClass: 'footer-default',
            popupClass: 'blackbackground',
            iconColor: 'var(--night-view-green)'
        },
        [swalTypes.error]: {
            confirmColor: 'var(--color-red)',
            titleClass: 'red',
            footerClass: 'footer-default',
            iconColor: 'red'
        },
        [swalTypes.warning]: {
            confirmColor: 'var(--night-view-green)',
            titleClass: 'cool-blue',
            footerClass: 'footer-default',
            iconColor: 'var(--color-cool-blue)'
        },
        [swalTypes.info]: {
            confirmColor: 'var(--night-view-green)',
            titleClass: 'cool-blue',
            footerClass: 'footer-default',
            iconColor: 'var(--night-view-purple)',

        }
    };

    const style = themeMap[icon] || themeMap[swalTypes.error];

    if ((!footer || footer === '') && icon === swalTypes.error) {
        footer = `<i>Need help? <a href="https://night-view.dk/kontakt/" target="_blank" rel="noopener noreferrer">Contact us</a>.</i>`;
    }

    if (icon === swalTypes.warning) timer = null;

    const config = {
        title,
        icon,
        html: html || undefined,
        text: html ? undefined : text,
        iconColor: style.iconColor,
        footer,
        confirmButtonText: confirmText,
        confirmButtonColor: confirmButtonColor || style.confirmColor,
        cancelButtonColor: cancelButtonColor || undefined,
        showCancelButton: showCancel || !!html,
        cancelButtonText: cancelText,
        timer: timer ? timer : null,
        reverseButtons,
        backdrop,
        position,
        customClass: {
            popup: defaultPopupClass,
            title: style.titleClass,
            htmlContainer: defaultTextClass,
            footer: style.footerClass,
            ...customClass
        }
    };

    return Swal.fire(config);
}

