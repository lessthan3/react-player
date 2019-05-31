import React, { Component } from 'react'
import { VASTClient, VASTTracker } from 'vast-client'
import { callPlayer } from '../utils'
import createSinglePlayer from '../singlePlayer'
import { FilePlayer } from './FilePlayer'

const MATCH_URL = /^VAST:https:\/\//i
export class VAST extends Component {
  static displayName = 'VAST';
  static canPlay = url => MATCH_URL.test(url);

  state = {
    sources: [],
    tracker: null,
    vastClient: new VASTClient()
  }

  callPlayer = callPlayer;

  createSourceFiles (mediaFiles = []) {
    return mediaFiles
      .map(({fileURL: src, mimeType: type} = {}) => ({src, type}))
      .filter(({src}) => FilePlayer.canPlay(src))
  }

  parseResponse (response) {
    const {onEnded} = this.props
    const {ads = []} = response

    // find video creatives
    // todo: handle companion ads
    for (const ad of ads) {
      const {creatives = []} = ad
      for (const creative of creatives) {
        const {mediaFiles = [], type} = creative
        if (type === 'linear') {
          const sources = this.createSourceFiles(mediaFiles)
          if (sources.length) {
            return this.setState({
              sources,
              // eslint-disable-next-line new-cap
              tracker: new VASTTracker(this.state.vastClient, ad, creative)
            })
          }
        }
      }

      return onEnded()
    }
  }

  load (rawUrl) {
    // replace [RANDOM] or [random] with a randomly generated cache value
    const ord = Math.random() * 10000000000000000
    const url = rawUrl.replace(/\[random]/ig, ord)
    this.state.vastClient.get(url.slice('VAST:'.length), { withCredentials: true }).then((response) => {
      this.parseResponse(response)
      const {tracker} = this.state
      if (tracker) {
        tracker.on('clickthrough', this.openAdLink)
      }
    }).catch((error) => {
      return this.props.onError(error)
    })
  }

  // todo: add skip functionality
  skip () {
    const {props: {onEnded}, state: {tracker}} = this
    if (tracker) {
      tracker.skip()
    }
    onEnded()
  }

  play () {
    this.container.play()
  }

  pause () {
    this.container.pause()
  }

  stop () {
    this.container.stop()
  }

  // only allow rewind
  seekTo (seconds) {
    if (seconds < this.container.getCurrentTime()) {
      this.container.seekTo(seconds)
    }
  }

  setVolume (fraction) {
    this.container.setVolume(fraction)
  }

  mute = () => {
    this.container.mute()
  };

  unmute = () => {
    this.container.unmute()
  };

  getDuration () {
    return this.container.getDuration()
  }

  getCurrentTime () {
    return this.container.getCurrentTime()
  }

  getSecondsLoaded () {
    return this.container.getSecondsLoaded()
  }

  ref = (container) => {
    this.container = container
  };

  onAdClick = () => {
    const {state: {tracker}} = this
    tracker.click()
  }

  openAdLink (url) {
    window.open(url, '_blank')
  }

  // track ended
  onEnded = (event) => {
    const {props: {onEnded}, state: {tracker}} = this
    if (tracker) {
      tracker.complete()
    }
    onEnded(event)
  }

  // track error
  onError = (event) => {
    const {props: {onError}, state: {tracker}} = this
    if (tracker) {
      tracker.errorWithCode(405)
    }
    onError(event)
  }

  // track pause
  onPause = (event) => {
    const {props: {onPause}, state: {tracker}} = this
    tracker.setPaused(true)
    onPause(event)
  }

  // track play
  onPlay = (event) => {
    const {props: {onPlay}, state: {tracker}} = this
    tracker.setPaused(false)
    onPlay(event)
  }

  onProgress = (event) => {
    const {props: {onProgress}, state: {tracker}} = this
    tracker.setProgress(event.playedSeconds)
    onProgress(event)
  }

  // track load and duration
  onReady = (event) => {
    const {props: {onReady}, state: {tracker}} = this
    tracker.load()
    if (Number.isNaN(tracker.assetDuration)) {
      tracker.assetDuration = this.container.getDuration()
    }
    onReady(event)
  }

  // track volume change
  onVolumeChange = (event) => {
    const {props: {onVolumeChange}, state: {tracker}} = this
    tracker.setMuted(this.container.muted)
    onVolumeChange(event)
  }

  render () {
    const {sources, tracker: clickTrackingURLTemplate} = this.state
    const { width, height } = this.props
    const wrapperStyle = {
      cursor: clickTrackingURLTemplate ? 'pointer' : 'default',
      height: '100%'
    }
    const videoStyle = {
      width: width === 'auto' ? width : '100%',
      height: height === 'auto' ? height : '100%'
    }
    return sources.length ? (
      <div onClick={this.onAdClick} style={wrapperStyle}>
        <FilePlayer
          {...this.props}
          onEnded={this.onEnded}
          onError={this.onError}
          onPause={this.onPause}
          onPlay={this.onPlay}
          onProgress={this.onProgress}
          onReady={this.onReady}
          onVolumeChange={this.onVolumeChange}
          ref={this.ref}
          style={videoStyle}
          url={this.state.sources[0].src}
        />
      </div>
    ) : null
  }
}

export default createSinglePlayer(VAST)
