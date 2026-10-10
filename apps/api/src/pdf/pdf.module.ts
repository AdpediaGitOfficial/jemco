import { Global, Module } from "@nestjs/common";
import { PdfService } from "./pdf.service";
import { StorageService } from "../attachments/storage";
@Global()
@Module({ providers: [PdfService, StorageService], exports: [PdfService] })
export class PdfModule {}
