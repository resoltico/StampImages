"use strict";

// ExifTool's fixed Filter program uses only public metadata APIs. Paths remain
// UserParam data; selectors/assignments are supplied by metadata-copy.js.
// Reader-only views never replace pixel input or actual target profile/maker data.
const METADATA_COPY_PROGRAM = String.raw`my $src=$self->Options('UserParam','source');
my $dst=$self->Options('UserParam','target');
my @captureSelectors=(@@CAPTURE_SELECTORS@@);
my $excludeMakerNotes=grep { $_ eq "-MakerNotes" } @captureSelectors;
my @failures;
my $add=sub { my($message)=@_;push @failures,$message if defined($message) && length($message) };
my $same;
$same=sub {
    my($a,$b)=@_;
    return 0 if defined($a) != defined($b);
    return 1 unless defined($a);
    my $r=ref($a);
    return 0 if $r ne ref($b);
    return "$a" eq "$b" unless $r;
    return $same->($$a,$$b) if $r eq 'SCALAR';
    if($r eq 'ARRAY') { return 0 unless @$a==@$b;for(my $i=0;$i<@$a;$i++){return 0 unless $same->($a->[$i],$b->[$i])}return 1 }
    if($r eq 'HASH') { return 0 unless keys(%$a)==keys(%$b);for my $k(keys %$a){return 0 unless exists($b->{$k}) && $same->($a->{$k},$b->{$k})}return 1 }
    return 0;
};
my $gps=sub {
    my($reader)=@_;my %values;
    for my $tag($reader->GetFoundTags) {
        my $family=$reader->GetGroup($tag,0);
        my $group=$reader->GetGroup($tag,1);
        my $name=Image::ExifTool::GetTagName($tag);
        next unless ($family eq 'EXIF' && $group eq 'GPS') || ($family eq 'XMP' && $name=~/^GPS/i);
        my $raw=scalar($reader->GetValue($tag,'Raw'));
        my $rational=scalar($reader->GetValue($tag,'Rational'));
        my $entry={tag=>$name,group=>$group,value=>defined($rational)?$rational:$raw,kind=>defined($rational)?'rational':'raw'};
        $entry->{format}=$reader->GetGroup($tag,6) if $family eq 'EXIF';
        my $key=$group.':'.$name;
        $add->('Ambiguous GPS values for '.$key) if exists($values{$key}) && !$same->($values{$key},$entry);
        $values{$key}=$entry;
    }
    return \%values;
};
my $messages=sub {
    my($reader)=@_;my @messages;
    for my $tag($reader->GetFoundTags) {
        my $name=Image::ExifTool::GetTagName($tag);
        next unless $name eq 'Warning' || $name eq 'Error';
        my $value=scalar($reader->GetValue($tag,'Raw'));
        push @messages,{kind=>$name,text=>$value} if defined($value);
    }
    return \@messages;
};
# ICC and explicitly excluded MakerNotes are outside capture-copy scope.
# Reader views never replace rendered pixels, source or actual target metadata.
my %captureIfd0=map { my $name=$_;$name=~s/^IFD0://;($name=>1) } grep { /^IFD0:/ } @captureSelectors;
my $captureSnapshot=sub {
    my($reader)=@_;my %values;
    for my $tag($reader->GetFoundTags) {
        my $family=$reader->GetGroup($tag,0);
        my $group=$reader->GetGroup($tag,1);
        my $name=Image::ExifTool::GetTagName($tag);
        next unless $family eq 'XMP' || $family eq 'IPTC' || $group eq 'ExifIFD' ||
            ($group eq 'IFD0' && $captureIfd0{$name});
        next if $excludeMakerNotes && $name=~/^MakerNote/;
        my $entry={value=>scalar($reader->GetValue($tag,'Raw'))};
        $entry->{format}=$reader->GetGroup($tag,6) if $family eq 'EXIF';
        my $key=$group.':'.$name;
        $add->('Ambiguous capture value for '.$key) if exists($values{$key}) && !$same->($values{$key},$entry);
        $values{$key}=$entry;
    }
    return \%values;
};
my $sourceInput=$src;
my $sourceMemory;
my $sourceNotice;
my $pendingSourceWrapper=0;
my $wrapperWarning='[minor] Improper EXIF header';
my $sourceReader=Image::ExifTool->new;
$sourceReader->Options(SaveFormat=>1,Struct=>1);
$sourceReader->ExtractInfo($src);
my $before=$gps->($sourceReader);
my $sourceMessages=$messages->($sourceReader);
my $sourceCaptureView;
my @excludedReaderGroups;
my $readerViewNotice;
my $readerViewOperationNotice;
my $knownWebP=sub {
    my($reader,$messages)=@_;
    return ($reader->GetValue('MIMEType','ValueConv')||'') eq 'image/webp' && @$messages==1 &&
        $messages->[0]{kind} eq 'Warning' && $messages->[0]{text} eq $wrapperWarning;
};
if(@$sourceMessages && !$knownWebP->($sourceReader,$sourceMessages) &&
    !grep { $_->{kind} eq 'Error' } @$sourceMessages) {
    my $blocks=Image::ExifTool->new;
    $blocks->ImageInfo($sourceInput,'ICC_Profile');
    my $block=scalar($blocks->GetValue('ICC_Profile','Raw'));
    my @viewGroups;
    push @viewGroups,'ICC_Profile' if defined($block);
    push @viewGroups,'MakerNotes' if $excludeMakerNotes;
    if(@viewGroups) {
        my $captureBefore=$captureSnapshot->($sourceReader);
        my $memoryWriter=Image::ExifTool->new;
        for my $group(@viewGroups) {
            my($deleted,$deleteError)=$memoryWriter->SetNewValue($group.':All',undef);
            $add->($deleteError);
            $add->('Capture reader-view exclusion could not be queued: '.$group) unless $deleted;
        }
        if(!@failures) {
            my $memoryStatus=$memoryWriter->WriteInfo($sourceInput,\$sourceCaptureView);
            for my $message(@{$messages->($memoryWriter)}) {
                if($message->{kind} eq 'Warning' && $message->{text} eq 'ICC_Profile deleted. Image colors may be affected' && grep { $_ eq 'ICC_Profile' } @viewGroups) {
                    $readerViewOperationNotice=$message->{text};
                } elsif($message->{kind} eq 'Warning' && $message->{text} eq $wrapperWarning &&
                    ($sourceReader->GetValue('MIMEType','ValueConv')||'') eq 'image/webp' &&
                    scalar(grep { $_->{kind} eq 'Warning' && $_->{text} eq $wrapperWarning } @$sourceMessages)) {
                    # This is still pending, not accepted. The existing wrapper
                    # repair below must verify its TIFF payload before any target write.
                    $pendingSourceWrapper=1;
                } else { $add->($message->{text}); }
            }
            $add->('Scoped metadata-reader view could not be built') unless $memoryStatus==1 || $memoryStatus==2;
            if(!@failures) {
                my $fresh=Image::ExifTool->new;
                $fresh->Options(SaveFormat=>1,Struct=>1);
                $fresh->ExtractInfo(\$sourceCaptureView);
                my $freshBlocks=Image::ExifTool->new;
                $freshBlocks->ImageInfo(\$sourceCaptureView,'ICC_Profile');
                $add->('ICC group remained in capture-reader view') if
                    (grep { $_ eq 'ICC_Profile' } @viewGroups) && defined($freshBlocks->GetValue('ICC_Profile','Raw'));
                if(grep { $_ eq 'MakerNotes' } @viewGroups) {
                    my $makerCheck=Image::ExifTool->new;
                    $makerCheck->Options(MakerNotes=>2);
                    $makerCheck->ExtractInfo(\$sourceCaptureView);
                    $add->('MakerNotes remained in capture-reader view') if
                        grep { Image::ExifTool::GetTagName($_)=~/^MakerNote/ } $makerCheck->GetFoundTags;
                }
                $add->('Scoped reader-view exclusion changed raw GPS') unless $same->($before,$gps->($fresh));
                $add->('Scoped reader-view exclusion changed capture values') unless $same->($captureBefore,$captureSnapshot->($fresh));
                if(!@failures) {
                    @excludedReaderGroups=@viewGroups;
                    $sourceInput=\$sourceCaptureView;
                    $sourceReader=$fresh;
                    $readerViewNotice=join('; ',map { $_->{text} } @$sourceMessages);
                    $sourceMessages=$messages->($fresh);
                }
            }
        }
    }
}
if(@$sourceMessages) {
    if(($sourceReader->GetValue('MIMEType','ValueConv')||'') eq 'image/webp' && @$sourceMessages==1 &&
        $sourceMessages->[0]{kind} eq 'Warning' && $sourceMessages->[0]{text} eq $wrapperWarning) {
        my $blocks=Image::ExifTool->new;
        $blocks->ImageInfo($sourceInput,'EXIF');
        my $block=scalar($blocks->GetValue('EXIF','Raw'));
        my $payload=ref($block) eq 'SCALAR'?$$block:$block;
        if(!defined($payload) || ref($payload) || $payload!~/^(II\x2a\0|MM\0\x2a)/) {
            $add->('Expected original WebP TIFF payload unavailable');
        } else {
            my $memoryWriter=Image::ExifTool->new;
            my($deleted,$deleteError)=$memoryWriter->SetNewValue('EXIF:All',undef);
            my($restored,$restoreError)=$memoryWriter->SetNewValue('EXIF',$block,Type=>'Raw',Protected=>1,Replace=>1);
            $add->($deleteError);$add->($restoreError);
            $add->('Source-memory EXIF rebuild could not be queued') unless $deleted && $restored;
            if(!@failures) {
                my $memoryStatus=$memoryWriter->WriteInfo($sourceInput,\$sourceMemory);
                $add->($_->{text}) for @{$messages->($memoryWriter)};
                $add->('Source-memory EXIF rebuild failed') unless $memoryStatus==1 || $memoryStatus==2;
                if(!@failures) {
                    my $fresh=Image::ExifTool->new;
                    $fresh->Options(SaveFormat=>1,Struct=>1);
                    $fresh->ExtractInfo(\$sourceMemory);
                    $add->($_->{text}) for @{$messages->($fresh)};
                    my $freshBlocks=Image::ExifTool->new;
                    $freshBlocks->ImageInfo(\$sourceMemory,'EXIF');
                    $add->($_->{text}) for @{$messages->($freshBlocks)};
                    my $freshBlock=scalar($freshBlocks->GetValue('EXIF','Raw'));
                    my $freshPayload=ref($freshBlock) eq 'SCALAR'?$$freshBlock:$freshBlock;
                    $add->('Source-memory rebuild changed original TIFF payload') unless
                        defined($freshPayload) && !ref($freshPayload) && $freshPayload eq $payload;
                    $add->('Source-memory rebuild changed raw GPS') unless $same->($before,$gps->($fresh));
                    if(!@failures) { $sourceInput=\$sourceMemory;$sourceNotice=$sourceMessages->[0]{text}; }
                }
            }
        }
    } else { $add->($_->{text}) for @$sourceMessages; }
}
$add->('Pending source WebP wrapper repair was not verified') if $pendingSourceWrapper && !defined($sourceNotice);
my $writer=Image::ExifTool->new;
my $sets=0;
my $set=sub {
    my($tag,$value,@options)=@_;
    my($count,$error)=$writer->SetNewValue($tag,$value,@options);
    $add->($error);
    $add->('Required metadata could not be queued: '.$tag) unless $count;
    $sets+=$count;
};
my $repair=0;
my $targetReader=Image::ExifTool->new;
$targetReader->ImageInfo($dst,'MIMEType','EXIF');
$add->(scalar($targetReader->GetValue('Error','Raw')));
my $targetWarning=scalar($targetReader->GetValue('Warning','Raw'));
if(($targetReader->GetValue('MIMEType','ValueConv')||'') eq 'image/webp') {
    my $block=scalar($targetReader->GetValue('EXIF','Raw'));
    if(defined($block)) {
        # Rebuild from the TARGET'S own complete EXIF block, not the source's.
        # This retains target-only/maker data and removes Vips' improper WebP wrapper.
        my $repairWriter=Image::ExifTool->new;
        my($deleted,$deleteError)=$repairWriter->SetNewValue('EXIF:All',undef);
        my($restored,$restoreError)=$repairWriter->SetNewValue('EXIF',$block,Type=>'Raw',Protected=>1,Replace=>1);
        $add->($deleteError);$add->($restoreError);
        $add->('The target EXIF repair could not be queued') unless $deleted && $restored;
        if(!@failures) {
            my $repairStatus=$repairWriter->WriteInfo($dst);
            $add->(scalar($repairWriter->GetValue('Error','Raw')));
            $add->(scalar($repairWriter->GetValue('Warning','Raw')));
            $add->('The target EXIF repair could not be written') unless $repairStatus==1 || $repairStatus==2;
            $repair=1 if !@failures;
        }
    }
}
$add->($targetWarning) if defined($targetWarning) && !$repair;
my $info=$writer->SetNewValuesFromFile($sourceInput,{Type=>'Raw'},@captureSelectors);
if(ref($info) ne 'HASH') { $add->('Capture metadata could not be read for copying') }
else { for my $key(keys %$info){$add->($info->{$key}) if $key=~/^(Warning|Error)/} }
for my $key(sort keys %$before) {
    my $entry=$before->{$key};
    if($entry->{group} eq 'GPS' && $entry->{tag}=~/^GPS(?:Latitude|Longitude)$/ && ($entry->{kind} ne 'rational' || $entry->{format} ne 'rational64u')) {
        $add->('Unsupported coordinate wire type: '.$key);next;
    }
    if($entry->{group} eq 'GPS' && $entry->{tag}=~/^GPS(?:Latitude|Longitude)Ref$/ && $entry->{format} ne 'string') {
        $add->('Unsupported reference wire type: '.$key);next;
    }
    if(!defined($entry->{value})){$add->('Raw GPS value unavailable: '.$key);next}
    $set->($key,$entry->{value},Type=>'Raw',Replace=>1);
}
# SaveBin/GetValue(Bin) is the documented original tag payload, unlike
# potentially rebuilt MakerNotes extraction. Only a physical empty IFD is requeued.
my $makerBlocks=sub {
    my($reader)=@_;my %blocks;
    for my $tag($reader->GetFoundTags) {
        my $name=Image::ExifTool::GetTagName($tag);
        next unless $reader->GetGroup($tag,0) eq 'EXIF' && $reader->GetTagID($tag) eq '37500';
        my $binary=scalar($reader->GetValue($tag,'Bin'));
        my $bytes=ref($binary) eq 'SCALAR'?$$binary:$binary;
        next unless defined($bytes) && !ref($bytes);
        my $group=$reader->GetGroup($tag,1);
        push @{$blocks{$group.':37500'}},{tag=>$group.':'.$name,bytes=>$bytes,format=>$reader->GetGroup($tag,6)};
    }
    return \%blocks;
};
my %emptyTargetExpected;
if(!@failures) {
    my $notes=Image::ExifTool->new;
    $notes->Options(MakerNotes=>2,SaveBin=>1,SaveFormat=>1,Duplicates=>1);
    $notes->ExtractInfo($dst);
    $add->($_->{text}) for @{$messages->($notes)};
    my $blocks=$makerBlocks->($notes);
    for my $key(keys %$blocks) {
        my @empty=grep { $_->{format} eq 'undef' && length($_->{bytes})==6 && $_->{bytes} eq "\0" x 6 } @{$blocks->{$key}};
        next unless @empty;
        if(grep { $_->{format} ne 'undef' || $_->{bytes} ne "\0" x 6 } @{$blocks->{$key}}) {
            $add->('Ambiguous empty target MakerNotes: '.$key);next;
        }
        $emptyTargetExpected{$key}="\0" x 6;
        $set->($empty[0]{tag},$empty[0]{bytes},Type=>'Raw',Protected=>1,Replace=>1);
    }
}
for my $assignment (@@ASSIGNMENTS@@) {
    my($tag,$value)=split(/=/,$assignment,2);
    my $type=$tag=~s/#$//?'ValueConv':'PrintConv';
    $set->($tag,length($value)?$value:undef,Type=>$type,Replace=>1);
}
my $rawStatus=0;
my $verified=0;
if(!@failures) {
    $rawStatus=$writer->WriteInfo($dst);
    $add->(scalar($writer->GetValue('Error','Raw')));
    $add->(scalar($writer->GetValue('Warning','Raw')));
    $add->('The private candidate could not be written') unless $rawStatus==1 || $rawStatus==2;
    if($rawStatus==1 || $rawStatus==2) {
        my $expectedReader=Image::ExifTool->new;
        $expectedReader->Options(SaveFormat=>1,Struct=>1);
        $expectedReader->ExtractInfo($sourceInput);
        my $actualReader=Image::ExifTool->new;
        $actualReader->Options(SaveFormat=>1,Struct=>1);
        $actualReader->ExtractInfo($dst);
        $add->($_->{text}) for @{$messages->($expectedReader)};
        $add->($_->{text}) for @{$messages->($actualReader)};
        my $expected=$gps->($expectedReader);
        my $actual=$gps->($actualReader);
        $verified=$same->($expected,$actual)?1:0;
        $add->('Raw GPS read-back differs from the captured source') unless $verified;
        if(%emptyTargetExpected) {
            my $notes=Image::ExifTool->new;
            $notes->Options(MakerNotes=>2,SaveBin=>1,SaveFormat=>1,Duplicates=>1);
            $notes->ExtractInfo($dst);
            $add->($_->{text}) for @{$messages->($notes)};
            my $blocks=$makerBlocks->($notes);
            for my $key(keys %emptyTargetExpected) {
                $add->('Empty target MakerNotes changed: '.$key) unless exists($blocks->{$key}) &&
                    @{$blocks->{$key}} && !grep { $_->{format} ne 'undef' || $_->{bytes} ne $emptyTargetExpected{$key} } @{$blocks->{$key}};
            }
        }
    }
}
$_={TargetFile=>$dst,ExifToolVersion=>scalar($self->GetValue('ExifToolVersion','Raw')),WriteStatus=>@failures?0:$rawStatus,RawWriteStatus=>$rawStatus,VerifiedGPS=>$verified,GPSInputCount=>scalar(keys %$before),RequiredSetCount=>$sets,FailureCount=>scalar(@failures),FailureText=>join("\n",@failures),RebuiltTargetWebPExif=>$repair};
$_->{TargetReadWarning}=$targetWarning if defined($targetWarning);

$_->{SourceReadNotice}=$sourceNotice if defined($sourceNotice);

$_->{ExcludedSourceReaderGroups}=\@excludedReaderGroups if @excludedReaderGroups;
$_->{SourceReaderViewNotice}=$readerViewNotice if defined($readerViewNotice);

$_->{SourceReaderViewOperationNotice}=$readerViewOperationNotice if defined($readerViewOperationNotice);

$_->{PreservedEmptyTargetMakerNotes}=scalar(keys %emptyTargetExpected) if %emptyTargetExpected && !@failures;
`;

module.exports = { METADATA_COPY_PROGRAM };
