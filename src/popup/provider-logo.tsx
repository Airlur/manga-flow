import { siDeepl, siGoogletranslate } from 'simple-icons';
import type { SVGProps } from 'react';

type ProviderKey = 'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl';

interface PopupProviderLogoProps {
    provider: ProviderKey;
}

const openAiLogoUrl = new URL('../assets/providers/openai-mark.svg', import.meta.url).href;

function SvgIcon({
    path,
    viewBox = '0 0 24 24',
    color = 'currentColor',
}: {
    path: string;
    viewBox?: string;
    color?: string;
}) {
    return (
        <svg viewBox={viewBox} aria-hidden="true" className="mf-popup-logo__svg">
            <path d={path} fill={color} />
        </svg>
    );
}

function MicrosoftLogo() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="mf-popup-logo__svg">
            <rect x="2.5" y="2.5" width="8.5" height="8.5" rx="1.2" fill="#f25022" />
            <rect x="13" y="2.5" width="8.5" height="8.5" rx="1.2" fill="#7fba00" />
            <rect x="2.5" y="13" width="8.5" height="8.5" rx="1.2" fill="#00a4ef" />
            <rect x="13" y="13" width="8.5" height="8.5" rx="1.2" fill="#ffb900" />
        </svg>
    );
}

function DeeplxBadge(props: SVGProps<SVGTextElement>) {
    return (
        <text x="16.8" y="8.5" fontSize="5.2" fontWeight="700" fill="#ffffff" {...props}>
            X
        </text>
    );
}

export function PopupProviderLogo({ provider }: PopupProviderLogoProps) {
    switch (provider) {
        case 'microsoft':
            return (
                <span className="mf-popup-logo mf-popup-logo--microsoft" aria-hidden="true">
                    <MicrosoftLogo />
                </span>
            );
        case 'google':
            return (
                <span className="mf-popup-logo mf-popup-logo--google" aria-hidden="true">
                    <SvgIcon path={siGoogletranslate.path} viewBox="0 0 24 24" color="#4285f4" />
                </span>
            );
        case 'deepl':
            return (
                <span className="mf-popup-logo mf-popup-logo--deepl" aria-hidden="true">
                    <SvgIcon path={siDeepl.path} viewBox="0 0 24 24" color="#0f2b46" />
                </span>
            );
        case 'deeplx':
            return (
                <span className="mf-popup-logo mf-popup-logo--deeplx" aria-hidden="true">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="mf-popup-logo__svg">
                        <path d={siDeepl.path} fill="#0f2b46" />
                        <DeeplxBadge />
                    </svg>
                </span>
            );
        case 'openai':
        default:
            return (
                <span className="mf-popup-logo mf-popup-logo--openai" aria-hidden="true">
                    <img className="mf-popup-logo__image" src={openAiLogoUrl} alt="" />
                </span>
            );
    }
}
