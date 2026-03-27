import { Bot, BrainCircuit, Globe2, Languages, Waypoints } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ProviderKey = 'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl';

const providerIconMap: Record<ProviderKey, LucideIcon> = {
    microsoft: Languages,
    google: BrainCircuit,
    openai: Bot,
    deeplx: Waypoints,
    deepl: Globe2,
};

const providerLabelMap: Record<ProviderKey, string> = {
    microsoft: 'MS',
    google: 'G',
    openai: 'AI',
    deeplx: 'DX',
    deepl: 'DL',
};

interface ProviderGlyphProps {
    provider: ProviderKey;
}

export function ProviderGlyph({ provider }: ProviderGlyphProps) {
    const Icon = providerIconMap[provider];

    return (
        <span className={`mf-provider-glyph mf-provider-glyph--${provider}`}>
            <span className="mf-provider-glyph__badge">{providerLabelMap[provider]}</span>
            <Icon className="mf-provider-glyph__icon" />
        </span>
    );
}
