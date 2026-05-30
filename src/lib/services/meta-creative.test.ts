// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { extractCreativeContent, type RawCreative } from './meta.service'

/**
 * Fixtures derivadas do spike real (2026-05-29) contra contas VSL/emagrecimento.
 * Cobrem os shapes que a Graph API retorna pra estas contas.
 */

describe('extractCreativeContent', () => {
  it('vídeo com top-level body/title espelhando video_data (caso comum)', () => {
    const c: RawCreative = {
      id: '1',
      name: 'AD',
      title: '👇 Clica em Saiba Mais',
      body: 'A caneta corta a fome. Mas ninguém te contou...',
      thumbnail_url: 'https://cdn/thumb.jpg',
      object_story_spec: {
        video_data: {
          message: 'A caneta corta a fome. Mas ninguém te contou...',
          title: '👇 Clica em Saiba Mais',
          video_id: '1010201424902818',
          image_url: 'https://cdn/vd-image.jpg',
        },
      },
    }
    const r = extractCreativeContent(c)
    expect(r.body).toBe('A caneta corta a fome. Mas ninguém te contou...')
    expect(r.title).toBe('👇 Clica em Saiba Mais')
    expect(r.videoId).toBe('1010201424902818')
    expect(r.thumbnailUrl).toBe('https://cdn/thumb.jpg')
    expect(r.type).toBe('video')
  })

  it('vídeo sem top-level: copy vem de video_data.message', () => {
    const c: RawCreative = {
      id: '2',
      object_story_spec: {
        video_data: {
          message: 'Copy da VSL aqui',
          video_id: 'vid123',
          image_url: 'https://cdn/vd.jpg',
        },
      },
    }
    const r = extractCreativeContent(c)
    expect(r.body).toBe('Copy da VSL aqui')
    expect(r.videoId).toBe('vid123')
    expect(r.thumbnailUrl).toBe('https://cdn/vd.jpg')
    expect(r.type).toBe('video')
  })

  it('Advantage+/dinâmico: copy de asset_feed_spec.bodies[].text', () => {
    const c: RawCreative = {
      id: '3',
      name: 'CRIATIVO_7',
      thumbnail_url: 'https://cdn/t.jpg',
      object_story_spec: {
        /* só page_id na real — sem video/link_data */
      },
      asset_feed_spec: {
        bodies: [{ text: 'Texto principal dinâmico' }],
        titles: [{ text: 'Headline dinâmico' }],
        descriptions: [{ text: 'Descrição dinâmica' }],
        videos: [{ video_id: 'afsvid', thumbnail_url: 'https://cdn/afs-thumb.jpg' }],
      },
    }
    const r = extractCreativeContent(c)
    expect(r.body).toBe('Texto principal dinâmico')
    expect(r.title).toBe('Headline dinâmico')
    expect(r.description).toBe('Descrição dinâmica')
    expect(r.videoId).toBe('afsvid')
    expect(r.thumbnailUrl).toBe('https://cdn/t.jpg') // top-level vence
    expect(r.type).toBe('video')
  })

  it('imagem/link: copy de link_data, sem vídeo → type image', () => {
    const c: RawCreative = {
      id: '4',
      thumbnail_url: 'https://cdn/img.jpg',
      object_story_spec: {
        link_data: {
          message: 'Mensagem do anúncio de imagem',
          name: 'Headline do link',
          description: 'Descrição do link',
        },
      },
    }
    const r = extractCreativeContent(c)
    expect(r.body).toBe('Mensagem do anúncio de imagem')
    expect(r.title).toBe('Headline do link')
    expect(r.description).toBe('Descrição do link')
    expect(r.videoId).toBeNull()
    expect(r.type).toBe('image')
  })

  it('carrossel: link_data.child_attachments → type carousel', () => {
    const c: RawCreative = {
      id: '5',
      thumbnail_url: 'https://cdn/c.jpg',
      object_story_spec: {
        link_data: {
          message: 'Carrossel copy',
          child_attachments: [{ link: 'a' }, { link: 'b' }],
        },
      },
    }
    const r = extractCreativeContent(c)
    expect(r.body).toBe('Carrossel copy')
    expect(r.type).toBe('carousel')
  })

  it('criativo mínimo (catálogo): tudo null, type unknown', () => {
    const c: RawCreative = { id: '6', name: 'Recepção - Imagem' }
    const r = extractCreativeContent(c)
    expect(r.body).toBeNull()
    expect(r.title).toBeNull()
    expect(r.thumbnailUrl).toBeNull()
    expect(r.videoId).toBeNull()
    expect(r.type).toBe('unknown')
  })

  it('precedência: top-level body vence sobre video_data.message', () => {
    const c: RawCreative = {
      id: '7',
      body: 'TOP LEVEL',
      object_story_spec: { video_data: { message: 'NESTED', video_id: 'v' } },
    }
    expect(extractCreativeContent(c).body).toBe('TOP LEVEL')
  })

  it('ignora strings vazias/whitespace na ladder', () => {
    const c: RawCreative = {
      id: '8',
      body: '   ',
      object_story_spec: { video_data: { message: 'copy real', video_id: 'v' } },
    }
    expect(extractCreativeContent(c).body).toBe('copy real')
  })
})
